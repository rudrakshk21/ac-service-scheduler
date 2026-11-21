import { useMemo, useState } from 'react'
import { normaliseName } from '../../intake/map/model'
import { useWorkspace } from '../../workspace/useWorkspace'
import { NumberField, Refusal, TextField } from './fields'
import * as act from './setupActions'
import { useAction } from './useAction'

export function PlacesSection() {
  const { workspace } = useWorkspace()
  const { run, error, clear } = useAction()
  const { places, aliases } = workspace.site
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ name: '', lat: '', lon: '', postal: '' })
  const [alias, setAlias] = useState({ spelling: '', place: '' })
  const shown = useMemo(() => {
    const q = normaliseName(query)
    return q === '' ? places : places.filter((p) => normaliseName(`${p.name} ${p.postalCode ?? ''}`).includes(q))
  }, [places, query])

  return (
    <section className="card stack" aria-labelledby="set-places">
      <h2 id="set-places" className="step-heading">Places ({places.length})</h2>
      <p className="muted small">Every visit needs a place with coordinates. You can also import a file of places in the Import tab.</p>
      {places.length > 8 && (
        <label className="field"><span className="label">Search places</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      )}
      {places.length === 0 && <p className="muted">No places yet. Import cases with coordinates, import a file of places, or add one below.</p>}
      <ul className="stack-tight">
        {shown.slice(0, 50).map((p) => (
          <li key={p.name} className="card editrow">
            <TextField label={`Name of ${p.name}`} hideLabel value={p.name} onCommit={(v) => run((x) => act.renamePlace(x, p.name, v))} />
            <NumberField label={`${p.name}: latitude`} value={p.latitude} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { latitude: v }))} help="Latitude" />
            <NumberField label={`${p.name}: longitude`} value={p.longitude} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { longitude: v }))} help="Longitude" />
            <TextField label={`${p.name}: postal code`} value={p.postalCode ?? ''} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { postalCode: v }))} help="Postal code" />
            <button type="button" className="btn" onClick={() => run((x) => act.removePlace(x, p.name))} aria-label={`Remove ${p.name}`}>Remove</button>
          </li>
        ))}
      </ul>
      {shown.length > 50 && <p className="muted small">Showing 50 of {shown.length}. Use the search to find the rest.</p>}

      <div className="card editrow">
        <label className="field"><span className="label">New place</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <label className="field"><span className="label">Latitude</span><input type="number" step="any" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} /></label>
        <label className="field"><span className="label">Longitude</span><input type="number" step="any" value={draft.lon} onChange={(e) => setDraft({ ...draft, lon: e.target.value })} /></label>
        <label className="field"><span className="label">Postal code (optional)</span><input type="text" value={draft.postal} onChange={(e) => setDraft({ ...draft, postal: e.target.value })} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addPlace(x, { name: draft.name, latitude: Number(draft.lat), longitude: Number(draft.lon), postalCode: draft.postal })); if (draft.name.trim() !== '' && draft.lat !== '' && draft.lon !== '') setDraft({ name: '', lat: '', lon: '', postal: '' }) }}>Add place</button>
      </div>

      <h3 className="group-title">Other spellings of a place</h3>
      <p className="muted small">Files spell places in different ways. Say which place a spelling means and it is matched during imports.</p>
      <ul className="rows">
        {Object.entries(aliases).map(([spelling, place]) => (
          <li key={spelling}>
            <span><b>{spelling}</b> means {place}</span>
            <button type="button" className="btn" onClick={() => run((x) => ({ ok: true, workspace: act.removeAlias(x, spelling) }))} aria-label={`Remove the spelling ${spelling}`}>Remove</button>
          </li>
        ))}
      </ul>
      {places.length > 0 && (
        <div className="card editrow">
          <label className="field"><span className="label">Spelling</span><input type="text" value={alias.spelling} onChange={(e) => { clear(); setAlias({ ...alias, spelling: e.target.value }) }} /></label>
          <label className="field"><span className="label">Means this place</span>
            <select value={alias.place || places[0].name} onChange={(e) => setAlias({ ...alias, place: e.target.value })}>{places.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addAlias(x, alias.spelling, alias.place || places[0].name)); if (alias.spelling.trim() !== '') setAlias({ ...alias, spelling: '' }) }}>Add spelling</button>
        </div>
      )}
      <Refusal error={error} />
    </section>
  )
}
