use anyhow::{Context, Result};
use bytes::Bytes;
use http_body_util::{combinators::BoxBody, BodyExt, Full};
use hyper::{Request, Response, StatusCode};
use hyper::body::Incoming;
use reqwest::{Client, Identity};
use std::fs::File;
use std::io::Read;

use crate::Args;

#[derive(Clone)]
pub struct ProxyState {
    pub client: Client,
    pub target_url: String,
}

impl ProxyState {
    pub async fn new(args: Args) -> Result<Self> {
        // Load the PKCS12 Certificate for WebID-TLS / mTLS
        let mut file = File::open(&args.cert_path)
            .context(format!("Failed to open certificate at {}", args.cert_path))?;
        let mut der = Vec::new();
        file.read_to_end(&mut der)?;
        
        let identity = Identity::from_pkcs12_der(&der, &args.cert_pass)
            .context("Failed to parse PKCS12 certificate. Check path and password.")?;
        
        // Build the reqwest client configured to use the client certificate
        let client = Client::builder()
            .identity(identity)
            // Allow self-signed certs for local development testing purposes
            .danger_accept_invalid_certs(true)
            .build()
            .context("Failed to build HTTP client with identity")?;

        Ok(Self {
            client,
            target_url: args.target_url,
        })
    }
}

pub async fn handle_request(
    req: Request<Incoming>,
    state: ProxyState,
) -> Result<Response<BoxBody<Bytes, hyper::Error>>, hyper::Error> {
    let method = req.method().clone();
    let uri = req.uri();
    
    // Construct the destination URL
    let path_and_query = uri.path_and_query().map(|pq| pq.as_str()).unwrap_or("");
    let dest_url = format!("{}{}", state.target_url.trim_end_matches('/'), path_and_query);

    // Read the incoming body
    let body_bytes = match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(e) => {
            eprintln!("Error reading body: {:?}", e);
            let mut response = Response::new(Full::new(Bytes::from("Error reading body")).map_err(|e| match e {}).boxed());
            *response.status_mut() = StatusCode::BAD_REQUEST;
            return Ok(response);
        }
    };

    // Forward the request
    let mut req_builder = state.client.request(method, &dest_url);
    
    // (In a full proxy, we would also copy headers over here, skipping host/connection)
    
    req_builder = req_builder.body(body_bytes);

    match req_builder.send().await {
        Ok(res) => {
            let status = res.status();
            
            // Collect the response body
            let body_bytes = res.bytes().await.unwrap_or_else(|_| Bytes::new());
            
            let mut response = Response::new(Full::new(body_bytes).map_err(|e| match e {}).boxed());
            *response.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
            
            Ok(response)
        },
        Err(e) => {
            eprintln!("Error forwarding request: {:?}", e);
            let mut response = Response::new(Full::new(Bytes::from("Bad Gateway")).map_err(|e| match e {}).boxed());
            *response.status_mut() = StatusCode::BAD_GATEWAY;
            Ok(response)
        }
    }
}
