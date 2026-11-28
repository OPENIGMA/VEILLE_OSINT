'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, X } from 'lucide-react';
import { Chip } from '@/components/chip';
import { NeonButton } from '@/components/ui/neon-button';
import { getSupabase } from '@/lib/supabase/client';
import { searchTerritories } from '@/lib/api';
import type { UiState } from '@/lib/search-url';
import {
  CONTENT_TYPES,
  SEVERITIES,
  TERRITORY_TYPES,
  THREAT_KINDS,
  type ContentKind,
  type SourceRss,
  type Territory,
  type Theme,
} from '@/lib/types';

export type FilterSection =
  | 'kinds'
  | 'themes'
  | 'territory'
  | 'gps'
  | 'dates'
  | 'entities'
  | 'content_types'
  | 'dataset'
  | 'threat'
  | 'sources';

export const inputCls =
  'h-10 w-full rounded-md border border-cyber-cyan/30 bg-cyber-bg/70 px-3 text-sm text-cyber-text placeholder:text-cyber-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan';

const FORMATS = ['csv', 'json', 'xlsx', 'geojson', 'shp', 'pdf', 'xml', 'parquet'];
const KINDS: { value: ContentKind; label: string }[] = [
  { value: 'article', label: 'Presse' },
  { value: 'dataset', label: 'Données' },
  { value: 'threat', label: 'Menaces' },
];

function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2 border-0 p-0">
      <legend className="mb-1 font-mono text-xs uppercase tracking-widest text-cyber-cyan">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Sélecteur de territoires : autocomplétion (nom, code INSEE, code postal). */
function TerritoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const listId = useId();
  const [text, setText] = useState('');
  const [options, setOptions] = useState<Territory[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Noms des territoires déjà sélectionnés (ex. arrivée depuis une URL partagée)
  useEffect(() => {
    const missing = value.filter((id) => !names[id]);
    if (missing.length === 0) return;
    let active = true;
    getSupabase()
      .from('territories')
      .select('id,name')
      .in('id', missing)
      .then(({ data }) => {
        if (!active || !data) return;
        setNames((prev) => {
          const next = { ...prev };
          for (const r of data as { id: string; name: string }[]) next[r.id] = r.name;
          return next;
        });
      });
    return () => {
      active = false;
    };
  }, [value, names]);

  const onType = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setError(false);
        setOptions(await searchTerritories(v));
      } catch {
        setError(true);
      }
    }, 250);
  };

  const add = (t: Territory) => {
    setNames((p) => ({ ...p, [t.id]: t.name }));
    if (!value.includes(t.id)) onChange([...value, t.id]);
    setText('');
    setOptions([]);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm text-cyber-muted" htmlFor={`${listId}-in`}>
        Zone, région, département, EPCI ou commune
      </label>
      <input
        id={`${listId}-in`}
        type="search"
        value={text}
        autoComplete="off"
        placeholder="Ex. Occitanie, 31, Toulouse, 13001"
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          // Entrée dans ce champ sélectionne la 1re suggestion au lieu d'envoyer le formulaire
          if (e.key === 'Enter' && options.length > 0) {
            e.preventDefault();
            add(options[0]);
          }
        }}
        aria-controls={options.length > 0 ? `${listId}-list` : undefined}
        aria-describedby={`${listId}-hint`}
        className={inputCls}
      />
      <p id={`${listId}-hint`} className="sr-only">
        Tapez au moins 2 caractères, puis choisissez une suggestion.
      </p>
      {error && (
        <p role="alert" className="text-xs text-cyber-magenta">
          Suggestions indisponibles.
        </p>
      )}
      {options.length > 0 && (
        <ul id={`${listId}-list`} className="max-h-56 overflow-auto rounded-md border border-cyber-cyan/30 bg-cyber-card">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => add(o)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cyber-cyan/10 focus-visible:bg-cyber-cyan/10 focus-visible:outline-none"
              >
                <span>{o.name}</span>
                <span className="font-mono text-xs text-cyber-muted">
                  {TERRITORY_TYPES[o.type]} · {o.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Territoires sélectionnés">
          {value.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
                className="inline-flex items-center gap-1 rounded-full border border-cyber-cyan bg-cyber-cyan/15 px-3 py-1 font-mono text-xs text-cyber-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan"
              >
                {names[id] ?? id}
                <X aria-hidden="true" className="h-3 w-3" />
                <span className="sr-only">Retirer {names[id] ?? id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SearchFilters({
  state,
  onChange,
  sections,
  themes,
  sources,
}: {
  state: UiState;
  onChange: (patch: Partial<UiState>) => void;
  sections: FilterSection[];
  themes: Theme[];
  sources: SourceRss[];
}) {
  const has = (s: FilterSection) => sections.includes(s);
  const [geoError, setGeoError] = useState<string | null>(null);

  const groups = Array.from(new Set(themes.map((t) => t.group_name)));

  const locate = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lon: Math.round(pos.coords.longitude * 10000) / 10000,
          radius_km: state.radius_km ?? 25,
        }),
      () => setGeoError('Position refusée ou indisponible.'),
      { timeout: 8000 },
    );
  };

  return (
    <div className="space-y-6">
      {has('kinds') && (
        <Fieldset legend="Type de contenu">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip
                key={k.value}
                pressed={state.kinds?.includes(k.value) ?? false}
                onClick={() => onChange({ kinds: toggle(state.kinds, k.value) })}
              >
                {k.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-cyber-muted">Aucun choix = tous les types.</p>
        </Fieldset>
      )}

      {has('themes') && (
        <Fieldset legend="Thématiques">
          {themes.length === 0 && <p className="text-xs text-cyber-muted">Thématiques indisponibles.</p>}
          {groups.map((g) => (
            <div key={g} className="space-y-1.5">
              <p className="text-xs text-cyber-muted">{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {themes
                  .filter((t) => t.group_name === g)
                  .map((t) => (
                    <Chip
                      key={t.slug}
                      tone={t.tone}
                      pressed={state.themes?.includes(t.slug) ?? false}
                      onClick={() => onChange({ themes: toggle(state.themes, t.slug) })}
                    >
                      {t.label}
                    </Chip>
                  ))}
              </div>
            </div>
          ))}
        </Fieldset>
      )}

      {has('territory') && (
        <Fieldset legend="Territoire">
          <TerritoryPicker value={state.territories ?? []} onChange={(territories) => onChange({ territories })} />
          <div>
            <label className="mb-1 block text-sm text-cyber-muted" htmlFor="f-cp">
              Code postal
            </label>
            <input
              id="f-cp"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={state.postal_code ?? ''}
              onChange={(e) => onChange({ postal_code: e.target.value.replace(/\D/g, '') })}
              placeholder="31000"
              className={inputCls}
            />
          </div>
        </Fieldset>
      )}

      {has('gps') && (
        <Fieldset legend="Rayon GPS">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['lat', 'Latitude', 'f-lat'],
                ['lon', 'Longitude', 'f-lon'],
                ['radius_km', 'Rayon (km)', 'f-r'],
              ] as const
            ).map(([key, label, id]) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-cyber-muted" htmlFor={id}>
                  {label}
                </label>
                <input
                  id={id}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={state[key] ?? ''}
                  onChange={(e) => onChange({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={`${inputCls} font-mono`}
                />
              </div>
            ))}
          </div>
          <NeonButton variant="ghost" size="sm" onClick={locate}>
            <LocateFixed aria-hidden="true" className="h-4 w-4" /> Ma position
          </NeonButton>
          {geoError && (
            <p role="alert" className="text-xs text-cyber-magenta">
              {geoError}
            </p>
          )}
          <p className="text-xs text-cyber-muted">Filtre les articles et menaces géolocalisés (jeux de données exclus).</p>
        </Fieldset>
      )}

      {has('dates') && (
        <Fieldset legend="Période">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-cyber-muted" htmlFor="f-from">
                Du
              </label>
              <input
                id="f-from"
                type="date"
                value={state.date_from ?? ''}
                onChange={(e) => onChange({ date_from: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-cyber-muted" htmlFor="f-to">
                Au (inclus)
              </label>
              <input
                id="f-to"
                type="date"
                value={state.date_to ?? ''}
                onChange={(e) => onChange({ date_to: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        </Fieldset>
      )}

      {has('content_types') && (
        <Fieldset legend="Nature du document">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CONTENT_TYPES).map(([value, label]) => (
              <Chip
                key={value}
                pressed={state.content_types?.includes(value) ?? false}
                onClick={() => onChange({ content_types: toggle(state.content_types, value) })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </Fieldset>
      )}

      {has('sources') && (
        <Fieldset legend="Source">
          {sources.length === 0 ? (
            <p className="text-xs text-cyber-muted">Aucune source configurée pour le moment.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <Chip
                  key={s.id}
                  pressed={state.sources?.includes(s.id) ?? false}
                  onClick={() => onChange({ sources: toggle(state.sources, s.id) })}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
        </Fieldset>
      )}

      {has('dataset') && (
        <Fieldset legend="Jeux de données">
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <Chip
                key={f}
                tone="lime"
                pressed={state.formats?.includes(f) ?? false}
                onClick={() => onChange({ formats: toggle(state.formats, f) })}
              >
                {f.toUpperCase()}
              </Chip>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted" htmlFor="f-lic">
              Licence (valeur exacte, ex. fr-lo)
            </label>
            <input
              id="f-lic"
              value={state.licence ?? ''}
              onChange={(e) => onChange({ licence: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted" htmlFor="f-prod">
              Producteur (nom exact)
            </label>
            <input
              id="f-prod"
              value={state.producer ?? ''}
              onChange={(e) => onChange({ producer: e.target.value })}
              className={inputCls}
            />
          </div>
        </Fieldset>
      )}

      {has('threat') && (
        <>
          <Fieldset legend="Gravité">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SEVERITIES).map(([value, s]) => (
                <Chip
                  key={value}
                  tone={s.tone}
                  pressed={state.severities?.includes(value) ?? false}
                  onClick={() => onChange({ severities: toggle(state.severities, value) })}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </Fieldset>
          <Fieldset legend="Nature de la menace">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(THREAT_KINDS).map(([value, label]) => (
                <Chip
                  key={value}
                  tone="magenta"
                  pressed={state.threat_kinds?.includes(value) ?? false}
                  onClick={() => onChange({ threat_kinds: toggle(state.threat_kinds, value) })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Fieldset>
        </>
      )}

      {has('entities') && (
        <Fieldset legend="Entités">
          <label className="mb-1 block text-xs text-cyber-muted" htmlFor="f-ent">
            Personnes, organisations, lieux ou acteurs (séparés par des virgules)
          </label>
          <input
            id="f-ent"
            value={(state.entities ?? []).join(', ')}
            onChange={(e) =>
              onChange({ entities: e.target.value.split(',').map((s) => s.trimStart()) })
            }
            placeholder="apt28, anssi"
            className={inputCls}
          />
        </Fieldset>
      )}
    </div>
  );
}
