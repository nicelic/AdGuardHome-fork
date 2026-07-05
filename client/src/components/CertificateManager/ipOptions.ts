import ipaddr from 'ipaddr.js';

export type CertificateManagerIPOption = {
    value: string;
    label: string;
    family: 'ipv4' | 'ipv6';
    source: string;
};

type CertificateManagerIPOptionsPayload = {
    items?: CertificateManagerIPOption[];
};

const normalizeIPToken = (raw: string): string => {
    const text = String(raw ?? '').trim().replace(/^\[/, '').replace(/\]$/, '');
    if (text === '' || !ipaddr.isValid(text)) {
        return '';
    }

    const parsed = ipaddr.parse(text);
    const normalized = parsed.toString();

    return parsed.kind() === 'ipv6' ? normalized.toLowerCase() : normalized;
};

const readSelectableIPValue = (entry: unknown): string => {
    if (typeof entry === 'string') {
        return entry;
    }
    if (entry && typeof entry === 'object') {
        const option = entry as { value?: unknown; label?: unknown };

        if (typeof option.value === 'string') {
            return option.value;
        }
        if (typeof option.label === 'string') {
            return option.label;
        }
    }

    return String(entry ?? '');
};

export const normalizeCertificateManagerIPList = (raw: unknown, limit = 100): string[] => {
    const source = Array.isArray(raw) ? raw : [raw];
    const seen = new Set<string>();
    const result: string[] = [];

    source.forEach((entry) => {
        readSelectableIPValue(entry)
            .replace(/,/g, ' ')
            .split(/\s+/)
            .forEach((token) => {
                const normalized = normalizeIPToken(token);
                if (normalized === '' || seen.has(normalized)) {
                    return;
                }

                seen.add(normalized);
                result.push(normalized);
            });
    });

    return result.slice(0, limit);
};

export const serializeCertificateManagerIPList = (values: string[]): string =>
    normalizeCertificateManagerIPList(values).join('\n');

export const normalizeCertificateManagerIPOptions = (
    raw: unknown,
): CertificateManagerIPOption[] => {
    const payload = (raw ?? {}) as CertificateManagerIPOptionsPayload;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const seen = new Set<string>();

    return items
        .map((entry) => {
            const value = normalizeIPToken(entry?.value || entry?.label || '');
            if (value === '' || seen.has(value)) {
                return null;
            }

            seen.add(value);

            return {
                value,
                label: value,
                family: entry.family === 'ipv6' ? 'ipv6' : 'ipv4',
                source: String(entry.source || ''),
            } as CertificateManagerIPOption;
        })
        .filter((entry): entry is CertificateManagerIPOption => entry !== null);
};

export const buildCertificateManagerIPSelectOptions = (
    items: CertificateManagerIPOption[],
    selectedValues: string[],
): { label: string; value: string }[] => {
    const options = new Map<string, { label: string; value: string }>();

    items.forEach((entry) => {
        options.set(entry.value, {
            label: entry.label,
            value: entry.value,
        });
    });

    normalizeCertificateManagerIPList(selectedValues).forEach((value) => {
        if (!options.has(value)) {
            options.set(value, {
                label: value,
                value,
            });
        }
    });

    return Array.from(options.values());
};
