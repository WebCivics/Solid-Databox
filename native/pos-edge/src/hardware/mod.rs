mod drawer;
mod printer_io;
mod display;

#[derive(Clone)]
pub struct HardwareConfig {
    pub printer_device: Option<String>,
    pub display_device: Option<String>,
    pub drawer_device: Option<String>,
    pub cash_drawer_via: String,
}

/// Dispatches a hardware command to the appropriate I/O driver.
pub fn execute_command(
    command: &str,
    raw_input: &str,
    config: &HardwareConfig,
) -> Result<(), String> {
    eprintln!(
        "[pos-edge:hw] Dispatching command: {} (drawer via: {})",
        command, config.cash_drawer_via
    );
    match command {
        "cash-drawer.open" => {
            drawer::open_cash_drawer(
                config.printer_device.as_deref(),
                config.drawer_device.as_deref(),
                &config.cash_drawer_via,
            )
            .map_err(|e| format!("cash-drawer.open failed: {}", e))
        }
        "receipt-printer.print-receipt" => {
            let device = config.printer_device.as_deref()
                .ok_or("No printer device configured")?;
            let input: serde_json::Value = serde_json::from_str(raw_input)
                .map_err(|e| format!("Invalid job input: {}", e))?;
            let text = input
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let qr_url = input
                .get("qrUrl")
                .and_then(|v| v.as_str());
            printer_io::print_receipt(device, text, qr_url)
                .map_err(|e| format!("receipt-printer.print-receipt failed: {}", e))
        }
        "receipt-printer.cut-paper" => {
            let device = config.printer_device.as_deref()
                .ok_or("No printer device configured")?;
            printer_io::cut_paper(device)
                .map_err(|e| format!("receipt-printer.cut-paper failed: {}", e))
        }
        "customer-display.show-text" => {
            let device = config.display_device.as_deref()
                .ok_or("No display device configured")?;
            let input: serde_json::Value = serde_json::from_str(raw_input)
                .map_err(|e| format!("Invalid job input: {}", e))?;
            let text = input
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            display::show_text(device, text)
                .map_err(|e| format!("customer-display.show-text failed: {}", e))
        }
        "customer-display.show-total" => {
            let device = config.display_device.as_deref()
                .ok_or("No display device configured")?;
            let input: serde_json::Value = serde_json::from_str(raw_input)
                .map_err(|e| format!("Invalid job input: {}", e))?;
            let total = input
                .get("total")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            display::show_total(device, total)
                .map_err(|e| format!("customer-display.show-total failed: {}", e))
        }
        "pos-terminal.request-payment" | "pos-terminal.cancel-payment" => {
            eprintln!("[pos-edge:hw] Terminal command {} queued (PCI scope — no hardware I/O)", command);
            Ok(())
        }
        _ => Err(format!("Unknown command: {}", command)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> HardwareConfig {
        HardwareConfig {
            printer_device: None,
            display_device: None,
            drawer_device: None,
            cash_drawer_via: "printer".to_string(),
        }
    }

    #[test]
    fn unknown_commands_are_rejected() {
        let err = execute_command("nonsense", "{}", &config()).unwrap_err();
        assert!(err.contains("Unknown command"));
    }

    #[test]
    fn hardware_commands_fail_closed_without_a_configured_device() {
        for (cmd, input) in [
            ("cash-drawer.open", "{}"),
            ("receipt-printer.print-receipt", r#"{"text":"x"}"#),
            ("receipt-printer.cut-paper", "{}"),
            ("customer-display.show-text", r#"{"text":"x"}"#),
            ("customer-display.show-total", r#"{"total":"1"}"#),
        ] {
            assert!(
                execute_command(cmd, input, &config()).is_err(),
                "{cmd} should fail closed without a device"
            );
        }
    }

    #[test]
    fn malformed_job_input_is_rejected_not_panicked() {
        let err = execute_command(
            "receipt-printer.print-receipt",
            "not json",
            &HardwareConfig {
                printer_device: Some("/dev/null".to_string()),
                ..config()
            },
        )
        .unwrap_err();
        assert!(err.contains("Invalid job input"));
    }

    #[test]
    fn pci_scoped_terminal_commands_queue_without_hardware_io() {
        for cmd in ["pos-terminal.request-payment", "pos-terminal.cancel-payment"] {
            execute_command(cmd, "{}", &config()).unwrap();
        }
    }
}
