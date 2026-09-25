use std::env;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

mod ipc;
mod http;
mod jobs;
mod hardware;

use jobs::JobQueue;

fn main() {
    let node_binary = env::var("POS_NODE_BINARY").unwrap_or_else(|_| "node".to_string());
    let node_config = env::var("POS_NODE_CONFIG").unwrap_or_else(|_| "config/cms/pos.json".to_string());
    let node_args: Vec<String> = env::var("POS_NODE_ARGS")
        .unwrap_or_default()
        .split_whitespace()
        .map(String::from)
        .collect();
    let http_port: u16 = env::var("POS_HTTP_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(9100);

    eprintln!("[pos-edge] Starting POS edge binary");
    eprintln!("[pos-edge] Node binary: {}", node_binary);
    eprintln!("[pos-edge] Node config: {}", node_config);
    eprintln!("[pos-edge] HTTP bridge port: {}", http_port);

    let printer_device = env::var("POS_PRINTER_DEVICE").ok();
    let display_device = env::var("POS_DISPLAY_DEVICE").ok();
    let drawer_device = env::var("POS_CASH_DRAWER_DEVICE").ok();
    let cash_drawer_via = env::var("POS_CASH_DRAWER_VIA")
        .unwrap_or_else(|_| "printer".to_string());

    let hardware_config = hardware::HardwareConfig {
        printer_device: printer_device.clone(),
        display_device: display_device.clone(),
        drawer_device,
        cash_drawer_via,
    };

    let job_queue = Arc::new(Mutex::new(JobQueue::new()));
    let hw_config = Arc::new(hardware_config);

    let child = spawn_node(&node_binary, &node_config, &node_args);
    let child = Arc::new(Mutex::new(child));

    let ipc_child = Arc::clone(&child);
    let ipc_queue = Arc::clone(&job_queue);
    thread::spawn(move || {
        ipc::run_lifecycle_loop(ipc_child, ipc_queue);
    });

    let http_queue = Arc::clone(&job_queue);
    let http_hw_config = Arc::clone(&hw_config);
    thread::spawn(move || {
        http::run_http_server(http_port, http_queue, http_hw_config);
    });

    let worker_queue = Arc::clone(&job_queue);
    let worker_hw_config = Arc::clone(&hw_config);
    thread::spawn(move || {
        jobs::run_job_worker(worker_queue, worker_hw_config);
    });

    eprintln!("[pos-edge] All threads started, waiting for node process to exit");
    {
        let mut guard = child.lock().unwrap();
        let _ = guard.wait();
    }
    eprintln!("[pos-edge] Node process exited, shutting down");
}

fn spawn_node(binary: &str, config: &str, extra_args: &[String]) -> Child {
    let mut cmd = Command::new(binary);
    cmd.arg("./bin/server.js")
        .arg("-c")
        .arg(config)
        .args(extra_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    cmd.spawn().expect("Failed to spawn Node process")
}
