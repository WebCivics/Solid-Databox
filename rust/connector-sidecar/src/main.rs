use anyhow::{Context, Result};
use clap::Parser;

mod ldap_mapper;
mod odbc_mapper;
mod solid_client;

/// Runtime Connector Sidecar for CommunitySolidServer CMS
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Action to perform: 'sync-ldap' or 'sync-odbc'
    #[arg(short, long)]
    action: String,

    /// Target Solid Pod Base URL (e.g., http://localhost:3000/)
    #[arg(short, long, default_value = "http://localhost:3000/")]
    solid_url: String,

    /// Solid Auth Token (Bearer)
    #[arg(short, long)]
    token: Option<String>,

    /// LDAP URL (for sync-ldap)
    #[arg(long)]
    ldap_url: Option<String>,

    /// ODBC Connection String (for sync-odbc)
    #[arg(long)]
    odbc_conn: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    println!("Starting Runtime Connector Sidecar...");
    
    let client = solid_client::SolidClient::new(args.solid_url, args.token)?;

    match args.action.as_str() {
        "sync-ldap" => {
            let ldap_url = args.ldap_url.context("LDAP URL is required for sync-ldap")?;
            println!("Running LDAP sync with URL: {}", ldap_url);
            ldap_mapper::sync_ldap(&ldap_url, &client).await?;
        }
        "sync-odbc" => {
            let odbc_conn = args.odbc_conn.context("ODBC connection string is required for sync-odbc")?;
            println!("Running ODBC sync...");
            odbc_mapper::sync_odbc(&odbc_conn, &client).await?;
        }
        _ => {
            eprintln!("Unknown action: {}. Use 'sync-ldap' or 'sync-odbc'.", args.action);
            std::process::exit(1);
        }
    }

    println!("Sync completed successfully.");
    Ok(())
}
