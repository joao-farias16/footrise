import { useState } from 'react';
import { CAREER } from '../../config/balance';
import { ATTR_META, POSITIONS, attrsByImportance } from '../../config/positions';
import { SELECTABLE_COUNTRIES } from '../../data/countries';
import { useGame } from '../../state/GameContext';
import type { DraftMode, Foot, PositionId } from '../../types';
import { Flag, TopBar } from '../common';

const PITCH: { id: PositionId; area: string }[] = [
  { id: 'PE', area: 'pe' },
  { id: 'ATA', area: 'ata' },
  { id: 'PD', area: 'pd' },
  { id: 'MEI', area: 'mei' },
  { id: 'VOL', area: 'vol' },
  { id: 'LE', area: 'le' },
  { id: 'ZAG', area: 'zag' },
  { id: 'LD', area: 'ld' },
  { id: 'GOL', area: 'gol' },
];

const AGES = Array.from({ length: CAREER.maxStartAge - CAREER.minStartAge + 1 }, (_, i) => CAREER.minStartAge + i);
const QUICK_NUMBERS = [1, 4, 5, 7, 8, 9, 10, 11];

export function CreateScreen() {
  const { startCareer, settings, savedCareer } = useGame();
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('BRA');
  const [age, setAge] = useState(17);
  const [position, setPosition] = useState<PositionId>('ATA');
  const [foot, setFoot] = useState<Foot>('D');
  const [number, setNumber] = useState('9');
  const [mode, setMode] = useState<DraftMode>(settings.defaultMode);
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim().replace(/\s+/g, ' ');
  const num = Number(number);
  const nameError = trimmed.length < 2 ? 'Digite um nome com pelo menos 2 letras.' : trimmed.length > 24 ? 'Máximo de 24 caracteres.' : null;
  const numberError = !Number.isInteger(num) || num < 1 || num > 99 ? 'Escolha um número de 1 a 99.' : null;
  const valid = !nameError && !numberError;
  const priorities = attrsByImportance(position).slice(0, 3);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    startCareer({ name: trimmed, nationality, startAge: age, position, foot, number: num }, mode);
  };

  return (
    <>
      <TopBar />
      <main className="page page-narrow">
        <form className="stack" onSubmit={submit} noValidate>
          <div>
            <div className="eyebrow">Nova carreira</div>
            <h1>Crie seu jogador</h1>
          </div>

          <div className="panel stack">
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                className="input"
                value={name}
                maxLength={30}
                autoComplete="off"
                placeholder="Ex.: João Farias"
                onChange={(e) => setName(e.target.value)}
                aria-invalid={touched && !!nameError}
                aria-describedby="name-err"
              />
              {touched && nameError && (
                <span id="name-err" className="error-text">
                  {nameError}
                </span>
              )}
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="nat">Nacionalidade</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: '1.6rem' }}>
                    <Flag code={nationality} />
                  </span>
                  <select id="nat" className="select" value={nationality} onChange={(e) => setNationality(e.target.value)}>
                    {SELECTABLE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="num">Número da camisa</label>
                <input
                  id="num"
                  className="input"
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  aria-invalid={touched && !!numberError}
                />
                <div className="segmented" aria-label="Números rápidos">
                  {QUICK_NUMBERS.map((n) => (
                    <button type="button" key={n} className="seg" aria-pressed={num === n} onClick={() => setNumber(String(n))} style={{ minWidth: 40, minHeight: 40 }}>
                      {n}
                    </button>
                  ))}
                </div>
                {touched && numberError && <span className="error-text">{numberError}</span>}
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="age-label">
                Idade inicial
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="age-label">
                {AGES.map((a) => (
                  <button type="button" role="radio" key={a} className="seg" aria-checked={age === a} onClick={() => setAge(a)}>
                    {a}
                  </button>
                ))}
              </div>
              <span className="faint">Mais jovem = mais tempo para evoluir, mas começa mais cru.</span>
            </div>

            <div className="field">
              <span className="field-label" id="foot-label">
                Pé dominante
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="foot-label">
                <button type="button" role="radio" className="seg" aria-checked={foot === 'D'} onClick={() => setFoot('D')}>
                  Direito
                </button>
                <button type="button" role="radio" className="seg" aria-checked={foot === 'E'} onClick={() => setFoot('E')}>
                  Esquerdo
                </button>
              </div>
            </div>
          </div>

          <div className="panel stack">
            <div className="field">
              <span className="field-label" id="pos-label">
                Posição
              </span>
              <div className="pitch" role="radiogroup" aria-labelledby="pos-label">
                {PITCH.map((p) => (
                  <button
                    type="button"
                    role="radio"
                    key={p.id}
                    className="pos-chip"
                    style={{ gridArea: p.area }}
                    aria-checked={position === p.id}
                    onClick={() => setPosition(p.id)}
                  >
                    {p.id}
                    <small>{POSITIONS[p.id].label}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="tip">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>{POSITIONS[position].label}:</strong> o overall valoriza principalmente{' '}
                {priorities.map((k) => ATTR_META[k].label.toLowerCase()).join(', ')}. A posição muda o que vale a pena pegar no draft.
              </span>
            </div>
          </div>

          <div className="panel stack">
            <span className="field-label" id="mode-label">
              Modo de draft
            </span>
            <div className="grid-2" role="radiogroup" aria-labelledby="mode-label">
              <button type="button" role="radio" className="mode-card" aria-checked={mode === 'analyst'} onClick={() => setMode('analyst')}>
                <strong>📊 ANALISTA</strong>
                <span className="muted">Veja todos os números das lendas e o impacto de cada escolha no seu potencial.</span>
              </button>
              <button type="button" role="radio" className="mode-card" aria-checked={mode === 'instinct'} onClick={() => setMode('instinct')}>
                <strong>🧠 INSTINTO</strong>
                <span className="muted">Números escondidos. Escolha pelo que você sabe de futebol. Tudo é revelado na carta.</span>
              </button>
            </div>
          </div>

          {savedCareer && (
            <p className="faint" style={{ textAlign: 'center' }}>
              ⚠️ Ao começar, a carreira em andamento de {savedCareer.profile.name} será descartada.
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-xl btn-block">
            Ir para o draft →
          </button>
        </form>
      </main>
    </>
  );
}
