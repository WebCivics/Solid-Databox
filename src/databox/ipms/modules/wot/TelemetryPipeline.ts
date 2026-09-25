import { randomUUID } from 'node:crypto';
import { BasicRepresentation } from '../../../../http/representation/BasicRepresentation';
import type { ResourceStore } from '../../../../storage/ResourceStore';
import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { ensureTrailingSlash } from '../../../../util/PathUtil';

/**
 * The SOSA/SSN telemetry pipeline (CIV-B33): a device reading lands as a standard SOSA
 * `Observation` RDF resource in the device's append-only telemetry container — the `acl:Append`
 * affordance the Thing Description declared. Observations are the W3C-standard shape
 * (sosa:madeBySensor / observedProperty / hasSimpleResult / resultTime) so a compliant consumer
 * (dashboards, the reasoning engine, a metering/billing adapter) reads them without a bespoke
 * schema — never a free-form blob.
 *
 * A device writes ONLY into its own telemetry container (append-only): the pipeline derives the
 * observation IRI under the device's telemetry href and `addResource`s it — a device cannot write
 * another thing's telemetry, and the container ACL is append-only so it cannot rewrite history.
 */

const TURTLE = 'text/turtle';
const SOSA = 'http://www.w3.org/ns/sosa/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

export interface SensorObservation {
  /** The device's WebID/URI (the `sosa:Sensor`/madeBySensor identity, from its TD). */
  readonly deviceId: string;
  /** The feature of interest the reading is about (e.g. `zone:living-room`, `meter:premise`). */
  readonly featureOfInterest: string;
  /** The observed property (e.g. `temperature`, `kwh-import`, `humidity`). */
  readonly observedProperty: string;
  /** The measured value. */
  readonly result: number;
  /** The unit label (e.g. `Cel`, `kWh`, `%`). */
  readonly unit: string;
  /** ISO-8601 result time — when the reading was taken (defaults to now). */
  readonly resultTime?: string;
}

export class TelemetryPipeline {
  private readonly deviceContainer: string;

  public constructor(
    private readonly store: ResourceStore,
    baseUrl: string,
    /** The container the TD's append-only telemetry affordance points at. */
    telemetryPath = '.databox/devices/telemetry/',
  ) {
    this.deviceContainer = `${ensureTrailingSlash(new URL(baseUrl).href)}${telemetryPath}`;
  }

  /**
   * Record a reading as a `sosa:Observation` resource. The device is identified by its WebID; the
   * observation IRI is minted under that device's telemetry path. Returns the observation IRI.
   */
  public async observe(observation: SensorObservation): Promise<string> {
    assertObservation(observation);
    const resultTime = observation.resultTime ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(resultTime))) {
      throw new BadRequestHttpError('An observation needs a valid ISO-8601 resultTime.');
    }
    // The device writes only under its own telemetry namespace — never another thing's.
    const deviceKey = encodeURIComponent(observation.deviceId).replaceAll('%', '-');
    const iri = `${this.deviceContainer}${deviceKey}/${randomUUID()}`;
    await this.store.setRepresentation(
      { path: iri },
      new BasicRepresentation(
        [ Buffer.from(observationTurtle(iri, observation, resultTime), 'utf-8') ],
        TURTLE,
      ),
    );
    return iri;
  }
}

function escLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

/** Serialise one observation as SOSA/SSN Turtle — the standard interop shape, not a bespoke blob. */
export function observationTurtle(iri: string, o: SensorObservation, resultTime: string): string {
  const esc = escLiteral;
  return `<${iri}> a <${SOSA}Observation> ;
  <${SOSA}madeBySensor> <${o.deviceId}> ;
  <${SOSA}hasFeatureOfInterest> "${esc(o.featureOfInterest)}" ;
  <${SOSA}observedProperty> "${esc(o.observedProperty)}" ;
  <${SOSA}hasSimpleResult> "${o.result}"^^<${XSD}decimal> ;
  <${SOSA}resultTime> "${esc(resultTime)}"^^<${XSD}dateTime> ;
  <${SOSA}phenomenonTime> "${esc(resultTime)}"^^<${XSD}dateTime> ;
  <${SOSA}usedProcedure> "telemetry-pipeline:observe" ;
  <http://qudt.org/1.1/schema/qudt#unit> "${esc(o.unit)}" .
`;
}

function assertObservation(o: SensorObservation): void {
  if (!/^https?:\/\//u.test(o.deviceId.trim())) {
    throw new BadRequestHttpError('An observation needs the device\'s absolute WebID URI.');
  }
  for (const field of [ 'featureOfInterest', 'observedProperty', 'unit' ] as const) {
    if (o[field].trim().length === 0) {
      throw new BadRequestHttpError(`An observation needs a non-empty ${field}.`);
    }
  }
  if (!Number.isFinite(o.result)) {
    throw new BadRequestHttpError('An observation needs a finite numeric result.');
  }
}
