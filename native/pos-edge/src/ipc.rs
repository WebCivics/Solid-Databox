use std::io::{BufRead, BufReader, Write};
use std::process::Child;
use std::sync::{Arc, Mutex};

use crate::jobs::JobQueue;

/// Reads structured events from Node's stdout (JSON lines) and writes
/// control commands to Node's stdin. This is the lifecycle channel.
pub fn run_lifecycle_loop(child: Arc<Mutex<Child>>, _job_queue: Arc<Mutex<JobQueue>>) {
    let stdout = {
        let mut guard = child.lock().unwrap();
        guard.stdout.take().expect("No stdout from Node")
    };
    let stdin = {
        let mut guard = child.lock().unwrap();
        guard.stdin.take().expect("No stdin to Node")
    };

    let reader = BufReader::new(stdout);
    let _writer = stdin;

    for line_result in reader.lines() {
        match line_result {
            Ok(line) => {
                if line.trim().is_empty() {
                    continue;
                }
                eprintln!("[pos-edge:ipc] Node stdout: {}", line);
                if let Some(event) = parse_lifecycle_event(&line) {
                    handle_lifecycle_event(&event);
                }
            }
            Err(e) => {
                eprintln!("[pos-edge:ipc] Error reading Node stdout: {}", e);
                break;
            }
        }
    }
}

#[derive(Debug)]
pub struct LifecycleEvent {
    pub event_type: String,
    pub port: Option<u16>,
    pub message: Option<String>,
}

fn parse_lifecycle_event(line: &str) -> Option<LifecycleEvent> {
    let trimmed = line.trim();
    if !trimmed.starts_with('{') {
        return None;
    }
    let parsed: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let event_type = parsed.get("type")?.as_str()?.to_string();
    let port = parsed.get("port").and_then(|v| v.as_u64()).map(|v| v as u16);
    let message = parsed.get("message").and_then(|v| v.as_str()).map(String::from);
    Some(LifecycleEvent { event_type, port, message })
}

fn handle_lifecycle_event(event: &LifecycleEvent) {
    match event.event_type.as_str() {
        "ready" => {
            eprintln!(
                "[pos-edge:ipc] Node is ready on port {}",
                event.port.unwrap_or(3000)
            );
        }
        "error" => {
            eprintln!(
                "[pos-edge:ipc] Node error: {}",
                event.message.as_deref().unwrap_or("unknown")
            );
        }
        "log" => {
            eprintln!(
                "[pos-edge:ipc] Node log: {}",
                event.message.as_deref().unwrap_or("")
            );
        }
        _ => {
            eprintln!("[pos-edge:ipc] Unknown event type: {}", event.event_type);
        }
    }
}

/// Sends a shutdown command to Node via stdin.
#[allow(dead_code)]
pub fn send_shutdown(writer: &mut impl Write) {
    let cmd = r#"{"cmd":"shutdown"}"#;
    let _ = writer.write_all(cmd.as_bytes());
    let _ = writer.write_all(b"\n");
    let _ = writer.flush();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_ready_event_with_port() {
        let event = parse_lifecycle_event(r#"{"type":"ready","port":9100}"#).unwrap();
        assert_eq!(event.event_type, "ready");
        assert_eq!(event.port, Some(9100));
        assert!(event.message.is_none());
    }

    #[test]
    fn parses_an_error_event_with_message() {
        let event = parse_lifecycle_event(r#"{"type":"error","message":"boom"}"#).unwrap();
        assert_eq!(event.event_type, "error");
        assert_eq!(event.message.as_deref(), Some("boom"));
        assert!(event.port.is_none());
    }

    #[test]
    fn ignores_non_json_lines_and_malformed_events() {
        assert!(parse_lifecycle_event("plain log line").is_none());
        assert!(parse_lifecycle_event("{ not json").is_none());
        assert!(parse_lifecycle_event(r#"{"no_type":1}"#).is_none());
        assert!(parse_lifecycle_event("").is_none());
    }

    #[test]
    fn send_shutdown_writes_one_json_line() {
        let mut buf: Vec<u8> = Vec::new();
        send_shutdown(&mut buf);
        let text = String::from_utf8(buf).unwrap();
        assert_eq!(text, "{\"cmd\":\"shutdown\"}\n");
        let parsed: serde_json::Value = serde_json::from_str(text.trim()).unwrap();
        assert_eq!(parsed["cmd"], "shutdown");
    }

    /// IPC smoke test: run the lifecycle loop against a child process whose
    /// stdout carries real lifecycle events; the loop must read them all and
    /// terminate cleanly when the child exits. Uses Node — the same runtime
    /// pos-edge supervises — when available, and is skipped otherwise.
    #[test]
    fn lifecycle_loop_reads_events_until_child_exits() {
        let script = "console.log(JSON.stringify({type:'ready',port:1}));\
                      console.log(JSON.stringify({type:'log',message:'hi'}));";
        let spawn = std::process::Command::new("node")
            .args(["-e", script])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();
        let Ok(child) = spawn else {
            eprintln!("node not available — skipping lifecycle-loop smoke test");
            return;
        };
        let child = Arc::new(Mutex::new(child));
        let queue = Arc::new(Mutex::new(JobQueue::new()));
        // Must return promptly rather than hang once the child closes stdout.
        run_lifecycle_loop(child, queue);
    }
}
