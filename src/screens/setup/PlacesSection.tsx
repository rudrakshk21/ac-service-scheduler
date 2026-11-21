import { useMemo, useState } from 'react'
import { formatNumber, t } from '../../i18n'
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
      <h2 id="set-places" className="step-heading">{t('setup.places.title', { n: formatNumber(places.length) })}</h2>
      <p className="muted small">{t('setup.places.help')}</p>
      {places.length > 8 && (
        <label className="field"><span className="label">{t('setup.places.search')}</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      )}
      {places.length === 0 && <p className="muted">{t('setup.places.none')}</p>}
      <ul className="stack-tight">
        {shown.slice(0, 50).map((p) => (
          <li key={p.name} className="card editrow">
            <TextField label={t('setup.places.nameOf', { name: p.name })} hideLabel value={p.name} onCommit={(v) => run((x) => act.renamePlace(x, p.name, v))} />
            <NumberField label={t('setup.places.latOf', { name: p.name })} value={p.latitude} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { latitude: v }))} help={t('setup.places.lat')} />
            <NumberField label={t('setup.places.lonOf', { name: p.name })} value={p.longitude} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { longitude: v }))} help={t('setup.places.lon')} />
            <TextField label={t('setup.places.postalOf', { name: p.name })} value={p.postalCode ?? ''} onCommit={(v) => run((x) => act.updatePlace(x, p.name, { postalCode: v }))} help={t('setup.places.postal')} />
            <button type="button" className="btn" onClick={() => run((x) => act.removePlace(x, p.name))} aria-label={t('setup.removeName', { name: p.name })}>{t('setup.remove')}</button>
          </li>
        ))}
      </ul>
      {shown.length > 50 && <p className="muted small">{t('setup.places.showing', { n: formatNumber(shown.length) })}</p>}

      <div className="card editrow">
        <label className="field"><span className="label">{t('setup.places.new')}</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <label className="field"><span className="label">{t('setup.places.lat')}</span><input type="number" step="any" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} /></label>
        <label className="field"><span className="label">{t('setup.places.lon')}</span><input type="number" step="any" value={draft.lon} onChange={(e) => setDraft({ ...draft, lon: e.target.value })} /></label>
        <label className="field"><span className="label">{t('setup.places.postalOptional')}</span><input type="text" value={draft.postal} onChange={(e) => setDraft({ ...draft, postal: e.target.value })} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addPlace(x, { name: draft.name, latitude: Number(draft.lat), longitude: Number(draft.lon), postalCode: draft.postal })); if (draft.name.trim() !== '' && draft.lat !== '' && draft.lon !== '') setDraft({ name: '', lat: '', lon: '', postal: '' }) }}>{t('setup.places.add')}</button>
      </div>

      <h3 className="group-title">{t('setup.alias.title')}</h3>
      <p className="muted small">{t('setup.alias.help')}</p>
      <ul className="rows">
        {Object.entries(aliases).map(([spelling, place]) => (
          <li key={spelling}>
            <span><b>{spelling}</b> {t('setup.alias.means', { place })}</span>
            <button type="button" className="btn" onClick={() => run((x) => ({ ok: true, workspace: act.removeAlias(x, spelling) }))} aria-label={t('setup.alias.remove', { spelling })}>{t('setup.remove')}</button>
          </li>
        ))}
      </ul>
      {places.length > 0 && (
        <div className="card editrow">
          <label className="field"><span className="label">{t('setup.alias.spelling')}</span><input type="text" value={alias.spelling} onChange={(e) => { clear(); setAlias({ ...alias, spelling: e.target.value }) }} /></label>
          <label className="field"><span className="label">{t('setup.alias.place')}</span>
            <select value={alias.place || places[0].name} onChange={(e) => setAlias({ ...alias, place: e.target.value })}>{places.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addAlias(x, alias.spelling, alias.place || places[0].name)); if (alias.spelling.trim() !== '') setAlias({ ...alias, spelling: '' }) }}>{t('setup.alias.add')}</button>
        </div>
      )}
      <Refusal error={error} />
    </section>
  )
}
