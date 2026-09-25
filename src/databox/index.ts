// Databox extension scaffold (DBX-09). Interfaces/types and fail-closed stubs for the accepted
// Databox-owned server-side components from the DBX-04 reference architecture. See
// databox/handoffs/DBX-09.md. No stub here silently permits access or claims conformance.

// Context (C3)
export * from './context/AuthenticatedContextExtractor';
export * from './context/DataboxRequestContext';
export * from './context/AssuranceCrosswalk';

// Tenant (C5)
export * from './tenant/TenantResolver';

// Authorization (C4)
export * from './authorization/DataboxAuthorizer';
export * from './authorization/ProductionInputResolver';
export * from './authorization/ResolverCollaborators';

// Storage (C6)
export * from './storage/AppendOnlyStore';

// Identifiers (C10)
export * from './identifiers/OpaqueIdentifierGenerator';

// Provisioning & relationship mapping (C10/C11, DBX-10)
export * from './provisioning/ProvisioningTypes';
export * from './provisioning/RelationshipMappingRegistry';
export * from './durable/DurableStateStore';
export * from './durable/DurableRegistries';
export * from './durable/DurableEvidenceLedger';
export * from './durable/RegistryInitializer';
export * from './provisioning/DataboxProvisioner';

// Evidence & receipts (C13/C19)
export * from './evidence/Evidence';

// Cursor feed (C15)
export * from './feed/CursorFeed';

// Transactional outbox & notification delivery (C14, DBX-21)
export * from './notification/NotificationDelivery';

// Synthetic institutional bridge (C21, DBX-22)
export * from './bridge/DataboxBridge';

// Reference consumer agent (C20, DBX-24)
export * from './agent/ReferenceConsumerAgent';

// Submission review & disposition workflow (C17, DBX-23)
export * from './review/DispositionWorkflow';

// Business mapping smithy control plane and demo API
export * from './smithy/MappingSmithyHttpApi';

// Live CSS integration (DBX-25)
export * from './integration/LiveDataboxHttpHandler';
export * from './ipms/VerticalProfile';
export * from './ipms/IpmsMigrationProof';
export * from './ipms/TableSessionStore';
export * from './ipms/OxigraphIpmsHydration';
export * from './ipms/OxigraphIpmsSync';
export * from './ipms/OxigraphIpmsSyncComposition';
export * from './ipms/modules/device-auth/DeviceFallbackAuth';
export * from './ipms/modules/integration/ConnectorContract';
export * from './ipms/modules/integration/ConnectorRuntimePlan';
export * from './ipms/modules/menu/Menu';
export * from './ipms/modules/pos/Cart';
export * from './ipms/modules/pos/CashRegister';
export * from './ipms/modules/pos/CustomerOrdering';
export * from './ipms/modules/pos/TableSession';
export * from './ipms/modules/pos/CustomerDisplay';
export * from './ipms/modules/pos/Order';
export * from './ipms/modules/pos/Promotion';
export * from './ipms/modules/pos/Ticket';
export * from './ipms/modules/pos/NativePosDeviceContract';
export * from './ipms/modules/website/PublicFeedRenderer';
export * from './ipms/modules/website/Seo';
export * from './ipms/modules/website/SitemapRobots';
export * from './ipms/modules/supply-chain/ChainOfCustody';
export * from './ipms/modules/wot/ThingDescription';
export * from './ipms/modules/wot/ThingRegistry';
export * from './ipms/modules/wot/TelemetryPipeline';
export * from './ipms/modules/wot/TelemetryBilling';
export * from './ipms/modules/community-library/CivicWindow';
export * from './ipms/modules/community-library/LivingArchive';
export * from './ipms/modules/community-library/ItemLending';
export * from './ipms/modules/community-library/SharedNamespace';
export * from './ipms/modules/social/BoundedSpace';
export * from './ipms/modules/community-ledger/ContributionLedger';
export * from './ipms/modules/community-ledger/PaybackWaterfall';
export * from './ipms/modules/community-ledger/CommunityStats';
export * from './ipms/modules/community-ledger/MilestoneSpine';
export * from './ipms/modules/community-ledger/CommonsMaintenance';
export * from './ipms/modules/community-ledger/ProjectFederation';
export * from './ipms/modules/concessions/EligibilityDecisionLog';
export * from './ipms/modules/concessions/ProgrammableGrant';

// Institution/program profile schema (C10/C11 provisioning inputs, DBX-06)
export * from './profile/InstitutionProfile';
export * from './profile/InstitutionProfileSchema';
export * from './profile/InstitutionProfileValidator';

// ODRL vocabulary & profile (C12, DBX-07)
export * from './odrl/terms';
export * from './odrl/TermSupport';

// ODRL evaluator & obligation engine (C12, DBX-20)
export * from './policy/BoundaryEnforcer';
export * from './policy/CapacityDelegation';
export * from './policy/DutyWeb';
export * from './policy/FiduciaryAudit';
export * from './policy/PolicyEngine';

// Human-reviewed, corpus-grounded compliance decision support (DBX-26)
export * from './compliance/AustralianComplianceRegistry';
export * from './compliance/ComplianceDigest';
export * from './compliance/ComplianceEngine';
export * from './compliance/ComplianceTypes';
export * from './compliance/ComplianceViews';

// Deposit/submission gateway (C7, DBX-15)
export * from './gateway/DepositSubmissionGateway';

// Verifiable record proof validation (C7/C16, DBX-16)
export * from './proof/RecordProofValidator';

// Signed acceptance receipts (C7/C13, DBX-18)
export * from './receipt/AcceptanceReceiptSigner';

// Connection credential lifecycle (C7/C9/C16, DBX-13)
export * from './credential/AnonymousAuditLedger';
export * from './credential/BitstringStatusList';
export * from './credential/ConnectionCredentialIssuer';
export * from './credential/ConnectionCredentialRegistry';
export * from './credential/ConnectionCredentialTypes';
export * from './credential/ConnectionCredentialValidator';
export * from './credential/Oidc4VpFlow';
export * from './credential/OfflineCredential';
export * from './credential/Es256';
export * from './credential/HolderKeyProof';
export * from './credential/ProvisionalTokenExchange';

// Personal databox profile (CIV-A01/A03/A04) — person-side hosting plan + apply-path;
// person-facing endpoints land here via CIV-A07.
export * from './personal/PersonalHostingConfig';
export * from './personal/PersonalHostingApi';
export * from './personal/PersonalVaultService';
export * from './personal/RemoteConsumeClient';
export * from './personal/CooperativeDnsClient';
export * from './personal/DynamicDnsClient';
export * from './personal/DigitalEstate';
export * from './personal/SafeExit';
export * from './personal/PodContinuity';
export * from './personal/PersonalOnboardingService';
export * from './personal/HttpPodProvisioner';
export * from './personal/OwnerKeyBackup';
export * from './personal/CooperativeMemberClient';
export * from './personal/CoopMemberHttpHandler';
export * from './personal/household/HouseholdProfile';
export * from './personal/household/HouseholdGovernance';
export * from './personal/household/Guardianship';
export * from './personal/household/GuardianNetwork';
export * from './personal/household/SafetyRecipes';
export * from './personal/household/WardDecisions';
export * from './personal/household/SpecialistAccess';
export * from './personal/household/HouseholdService';
export * from './personal/household/HouseholdHttpHandler';
export * from './consume/ConsumeApi';
export * from './consume/ConsumeHttpHandler';
export * from './disclosure/ScopedDisclosure';

// Optional profile-agnostic modules (licensing/packaging boundary — CIV-B53..55).
export * from './modules/DataboxModuleManifest';
export * from './modules/rdf/SparqlEngine';
export * from './modules/rdf/RemoteSparqlEngine';
export * from './modules/rdf/SparqlEngineFactory';
export * from './modules/oxigraph/OxigraphModule';
export * from './modules/oxigraph/OxigraphSparqlHttpHandler';
export * from './modules/llm/EdgeInference';
export * from './modules/llm/LlmBackend';
export * from './modules/llm/PodRdfTools';
export * from './modules/llm/PodStoreAdapters';
export * from './modules/llm/PodBoundLlmAgent';
export * from './modules/llm/ProvActivityLog';
export * from './modules/llm/VoiceIntentPipeline';
