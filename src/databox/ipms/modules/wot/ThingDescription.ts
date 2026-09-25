import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';

/**
 * A W3C Web-of-Things Thing Description (TD) builder for a pod-attached device (CIV-B7 /
 * `databox.html#devices-wot`). A device is represented *as a pod resource* — a JSON-LD TD under
 * `/.databox/devices/` — so it is discoverable, WAC-governed and backed up with the pod like any
 * other resource, rather than living in a side registry.
 *
 * The TD declares the device's affordances (readable properties, invocable actions, emitted events)
 * and the security scheme the databox uses (DPoP-bound bearer — the same Solid-OIDC credential the
 * device-auth module enrols). Telemetry/event affordances carry an `acl:Append`-only write intent —
 * a device can contribute readings but can never read or rewrite another's (least privilege).
 */

/** The WoT TD 1.1 context (pinned — a device doc must declare the versioned context). */
export const WOT_TD_CONTEXT = 'https://www.w3.org/2022/wot/td/v1.1';

export interface ThingAffordance {
  /** The affordance key (e.g. `temperature`, `open`, `readings`). */
  readonly name: string;
  /** A short human label/description. */
  readonly description?: string;
  /** The pod-relative href the affordance maps to (e.g. `telemetry/temp`). */
  readonly href: string;
  /** For properties: the value media type / schema hint. */
  readonly contentType?: string;
  /** Whether the affordance is append-only (telemetry) vs readable. */
  readonly appendOnly?: boolean;
}

export interface ThingDescriptionInput {
  /** The device's WebID/URI (its databox identity, from device-auth enrolment). */
  readonly deviceId: string;
  /** Human-readable title. */
  readonly title: string;
  /** The device type label (e.g. `pos-terminal`, `sensor`, `appliance`). */
  readonly deviceType: string;
  /** The base href the affordance hrefs resolve against (the device's pod root). */
  readonly base: string;
  /** Readable/appendable property affordances. */
  readonly properties?: readonly ThingAffordance[];
  /** Invocable action affordances. */
  readonly actions?: readonly ThingAffordance[];
  /** Emitted event affordances (device → pod telemetry). */
  readonly events?: readonly ThingAffordance[];
}

export interface ThingDescription {
  readonly '@context': string;
  readonly '@type': 'Thing';
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly securityDefinitions: Record<string, unknown>;
  readonly security: readonly string[];
  readonly base: string;
  readonly properties?: Record<string, unknown>;
  readonly actions?: Record<string, unknown>;
  readonly events?: Record<string, unknown>;
}

const DEVICE_ID = /^https?:\/\//u;

/** Build a WoT Thing Description for a device — pure; the registry persists it. */
export function buildThingDescription(input: ThingDescriptionInput): ThingDescription {
  const deviceId = input.deviceId.trim();
  if (!DEVICE_ID.test(deviceId)) {
    throw new BadRequestHttpError(`A Thing's device id must be an absolute URI, got "${input.deviceId}".`);
  }
  if (input.title.trim().length === 0) {
    throw new BadRequestHttpError('A Thing needs a non-empty title.');
  }
  if (!DEVICE_ID.test(input.base.trim())) {
    throw new BadRequestHttpError('A Thing needs an absolute `base` URI its affordances resolve against.');
  }

  const td: ThingDescription = {
    '@context': WOT_TD_CONTEXT,
    '@type': 'Thing',
    id: deviceId,
    title: input.title.trim(),
    description: `${input.deviceType} device bound to ${input.base}`,
    // The databox device credential is a DPoP-bound bearer — the TD advertises the scheme so a
    // WoT consumer knows how to authenticate the affordance calls (never a platform-wide key).
    securityDefinitions: {
      databox_dpop: { scheme: 'bearer', alg: 'ES256', format: 'dpop+jwt', in: 'header' },
    },
    security: [ 'databox_dpop' ],
    base: input.base.trim(),
  };

  const properties = affordances(input.properties, 'property');
  if (Object.keys(properties).length > 0) {
    (td as { properties?: Record<string, unknown> }).properties = properties;
  }
  const actions = affordances(input.actions, 'action');
  if (Object.keys(actions).length > 0) {
    (td as { actions?: Record<string, unknown> }).actions = actions;
  }
  const events = affordances(input.events, 'event');
  if (Object.keys(events).length > 0) {
    (td as { events?: Record<string, unknown> }).events = events;
  }
  return td;
}

function affordances(
  list: readonly ThingAffordance[] | undefined,
  kind: 'property' | 'action' | 'event',
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const affordance of list ?? []) {
    if (affordance.name.trim().length === 0 || affordance.href.trim().length === 0) {
      throw new BadRequestHttpError(`A Thing ${kind} needs a name and an href.`);
    }
    const entry: Record<string, unknown> = {
      href: affordance.href.trim(),
      ...affordance.description === undefined ? {} : { description: affordance.description.trim() },
      ...affordance.contentType === undefined ? {} : { contentType: affordance.contentType },
    };
    // Append-only affordances declare the device's least-privilege write intent (telemetry/events):
    // a device contributes readings but can never read or rewrite — the ACL enforces it.
    if (affordance.appendOnly === true) {
      entry['acl:access'] = 'append';
    }
    out[affordance.name.trim()] = kind === 'property' ?
        { ...entry, type: 'object', observable: false } :
      kind === 'action' ?
          { ...entry, input: { type: 'object' }} :
          { ...entry, data: { type: 'object' }};
  }
  return out;
}
