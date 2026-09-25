#![windows_subsystem = "windows"]

use anyhow::Result;
use muda::{Menu, PredefinedMenuItem, MenuItem};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::TrayIconBuilder;
use std::sync::{Arc, Mutex};

mod server_process;

#[tokio::main]
async fn main() -> Result<()> {
    // Create the TAO event loop
    let event_loop = EventLoopBuilder::new().build();

    // Create the menu
    let menu = Menu::new();
    let start_stop_i = MenuItem::new("Start Server", true, None);
    let open_admin_i = MenuItem::new("Open Admin", true, None);
    let open_logs_i = MenuItem::new("Open Logs", true, None);
    let quit_i = MenuItem::new("Quit", true, None);

    menu.append_items(&[
        &start_stop_i,
        &PredefinedMenuItem::separator(),
        &open_admin_i,
        &open_logs_i,
        &PredefinedMenuItem::separator(),
        &quit_i,
    ])?;

    // We can use a transparent or simple embedded icon
    // Kept alive for the program's lifetime — dropping it would remove the tray icon.
    let _tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("Databox CMS Supervisor")
        .with_title("CMS")
        .build()?;

    let mut is_running = false;
    let menu_channel = muda::MenuEvent::receiver();
    let tray_channel = tray_icon::TrayIconEvent::receiver();

    let server = Arc::new(Mutex::new(server_process::ServerProcess::new()));

    event_loop.run(move |_event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Ok(event) = menu_channel.try_recv() {
            if event.id == quit_i.id() {
                let mut srv = server.lock().unwrap();
                srv.stop();
                *control_flow = ControlFlow::Exit;
            } else if event.id == start_stop_i.id() {
                let mut srv = server.lock().unwrap();
                if is_running {
                    srv.stop();
                    start_stop_i.set_text("Start Server");
                    is_running = false;
                } else {
                    srv.start();
                    start_stop_i.set_text("Stop Server");
                    is_running = true;
                }
            } else if event.id == open_admin_i.id() {
                let _ = open::that("http://localhost:3000/.databox/forge");
            } else if event.id == open_logs_i.id() {
                let srv = server.lock().unwrap();
                let _ = open::that(srv.logs_path());
            }
        }
        
        if let Ok(_event) = tray_channel.try_recv() {
            // Optional: double click to open admin
            // if event.click_type == tray_icon::ClickType::Double {
            //     let _ = open::that("http://localhost:3000/.databox/forge");
            // }
        }
    });
}
