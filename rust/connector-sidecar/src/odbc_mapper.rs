use anyhow::{Context, Result};
use odbc_api::{Environment, Cursor};
use crate::solid_client::SolidClient;
use std::sync::OnceLock;

static ENV: OnceLock<Environment> = OnceLock::new();

pub async fn sync_odbc(conn_str: &str, solid: &SolidClient) -> Result<()> {
    let env = ENV.get_or_init(|| Environment::new().unwrap());
    
    // Connect
    let conn = env.connect_with_connection_string(conn_str, odbc_api::ConnectionOptions::default())
        .context("Failed to connect to ODBC data source")?;

    // Execute a query (we assume there's an 'employees' table for the example)
    match conn.execute("SELECT id, name, department FROM employees", (), None)? {
        Some(mut cursor) => {
            let mut buffers = odbc_api::buffers::TextRowSet::for_cursor(100, &mut cursor, Some(4096))?;
            let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;
            
            while let Some(batch) = row_set_cursor.fetch()? {
                for i in 0..batch.num_rows() {
                    let id = batch.at(0, i).unwrap_or(b"unknown");
                    let id_str = std::str::from_utf8(id).unwrap_or("unknown");

                    let name = batch.at(1, i).unwrap_or(b"Unknown");
                    let name_str = std::str::from_utf8(name).unwrap_or("Unknown");

                    let dept = batch.at(2, i).unwrap_or(b"General");
                    let dept_str = std::str::from_utf8(dept).unwrap_or("General");
                    
                    let turtle = format!(
                        "@prefix org: <http://www.w3.org/ns/org#> .\n\
                         @prefix foaf: <http://xmlns.com/foaf/0.1/> .\n\
                         \n\
                         <#it> a foaf:Person ;\n\
                         \tfoaf:name \"{}\" ;\n\
                         \torg:memberOf <urn:department:{}> .\n",
                        name_str, dept_str
                    );

                    let path = format!("/.databox/sync/odbc/{}.ttl", id_str);
                    println!("Syncing ODBC row {} to {}", id_str, path);
                    solid.upload_rdf(&path, &turtle).await?;
                }
            }
        },
        None => {
            println!("Query did not return a result set.");
        }
    }
    
    Ok(())
}
