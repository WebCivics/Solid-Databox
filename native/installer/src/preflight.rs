use crate::shape::InstallProfile;

/// Step 1: Pre-flight environment assessment.
/// Detects OS, architecture, privileges, and port availability.
pub fn run(profile: &InstallProfile) -> Result<(), String> {
    let os = detect_os();
    let arch = detect_arch();
    println!("  OS: {}", os);
    println!("  Architecture: {}", arch);

    check_privileges(&os)?;

    let port_available = check_port(profile.required_port);
    if !port_available {
        return Err(format!(
            "Port {} is already in use. Free it or specify a different port.",
            profile.required_port
        ));
    }
    println!("  Port {} is available", profile.required_port);

    Ok(())
}

fn detect_os() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    return "unknown".to_string();
}

fn detect_arch() -> String {
    #[cfg(target_arch = "x86_64")]
    return "x86_64".to_string();
    #[cfg(target_arch = "aarch64")]
    return "aarch64".to_string();
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    return std::env::consts::ARCH.to_string();
}

fn check_privileges(os: &str) -> Result<(), String> {
    match os {
        "windows" => {
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                let output = Command::new("net")
                    .args(["session"])
                    .output()
                    .map_err(|e| format!("Failed to check privileges: {}", e))?;
                if output.status.success() {
                    println!("  Running as Administrator — service registration enabled");
                } else {
                    println!("  Warning: not running as Administrator — service registration may fail");
                    println!("  Consider re-running with elevated privileges for full service registration");
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                println!("  Note: Administrator privileges recommended for service registration");
            }
            Ok(())
        }
        "linux" | "macos" => {
            // Check if running as root or with sudo
            let uid = unsafe { libc_getuid() };
            if uid == 0 {
                println!("  Running as root — service registration enabled");
            } else {
                println!("  Warning: not running as root — service registration may fail");
                println!("  Consider re-running with sudo for full service registration");
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

fn check_port(port: u16) -> bool {
    // Try to bind to the port — if it succeeds, the port is available
    use std::net::TcpListener;
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
extern "C" {
    fn getuid() -> u32;
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
unsafe fn libc_getuid() -> u32 {
    getuid()
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
unsafe fn libc_getuid() -> u32 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_and_arch_detection_return_known_values() {
        assert!(["windows", "linux", "macos", "unknown"].contains(&detect_os().as_str()));
        assert!(["x86_64", "aarch64"].contains(&detect_arch().as_str())
            || cfg!(not(any(target_arch = "x86_64", target_arch = "aarch64"))));
    }

    #[test]
    fn check_port_reports_an_occupied_port_unavailable() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(!check_port(port));
        drop(listener);
    }

    #[test]
    fn check_port_reports_a_free_port_available() {
        // Bind, record the port, release, then confirm it is reported free.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        assert!(check_port(port));
    }
}
