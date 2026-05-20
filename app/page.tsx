'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Card {
  id: string;
  name: string;
  arcana: string;
  suit: string | null;
  keywords: string[];
  upright: string;
  reversed: string;
}

interface SelectedCard {
  card: Card;
  isReversed: boolean;
  position: string;
}

const POSITIONS_3 = ['Past', 'Present', 'Future'];

export default function TarotApp() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [shuffledCards, setShuffledCards] = useState<Card[]>([]);
  const [spreadMode, setSpreadMode] = useState<1 | 3>(1);
  const [selectedCards, setSelectedCards] = useState<SelectedCard[]>([]);
  const [gridHint, setGridHint] = useState('The cards await. Choose one.');
  const [error, setError] = useState('');
  const questionRef = useRef<HTMLInputElement>(null);

  // Overlay / reading state
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardInfoVisible, setCardInfoVisible] = useState(false);
  const [fortuneVisible, setFortuneVisible] = useState(false);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [fortuneText, setFortuneText] = useState('');

  useEffect(() => {
    fetch('/api/cards')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((cards: Card[]) => {
        setAllCards(cards);
        setShuffledCards([...cards].sort(() => Math.random() - 0.5));
      })
      .catch(() => setError('Could not reach the server.'));
  }, []);

  // Flip sequence — triggered when overlay opens, short delay lets images load
  useEffect(() => {
    if (!overlayVisible) return;
    const t1 = setTimeout(() => setIsFlipped(true), 400);
    const t2 = setTimeout(() => setCardInfoVisible(true), 400 + 700 + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [overlayVisible]);

  const getFortune = useCallback(async (body: Record<string, unknown>, signal: AbortSignal) => {
    setFortuneText('');
    setFortuneLoading(true);
    setFortuneVisible(true);
    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      setFortuneLoading(false);
      if (!res.ok || !res.body) {
        setFortuneText('The oracle is unavailable.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setFortuneText(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setFortuneLoading(false);
      setFortuneText('The oracle is silent.');
    }
  }, []);

  // Start fortune after card info becomes visible
  useEffect(() => {
    if (!cardInfoVisible || selectedCards.length === 0) return;
    const controller = new AbortController();
    const question = questionRef.current?.value.trim() ?? '';

    if (spreadMode === 1) {
      const { card, isReversed } = selectedCards[0];
      getFortune({ card_id: card.id, orientation: isReversed ? 'reversed' : 'upright', question }, controller.signal);
    } else {
      getFortune({
        cards: selectedCards.map(sc => ({
          card_id: sc.card.id,
          orientation: sc.isReversed ? 'reversed' : 'upright',
          position: sc.position,
        })),
        question,
      }, controller.signal);
    }
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardInfoVisible]);

  const resetReading = () => {
    setIsFlipped(false);
    setCardInfoVisible(false);
    setFortuneVisible(false);
    setFortuneLoading(false);
    setFortuneText('');
  };

  const doRenderGrid = useCallback((cards: Card[], mode: 1 | 3) => {
    setSelectedCards([]);
    setShuffledCards([...cards].sort(() => Math.random() - 0.5));
    setGridHint(mode === 1 ? 'The cards await. Choose one.' : 'Choose your first card — Past');
    setError('');
  }, []);

  const changeSpreadMode = (mode: 1 | 3) => {
    setSpreadMode(mode);
    setOverlayVisible(false);
    resetReading();
    doRenderGrid(allCards, mode);
  };

  const closeModal = () => {
    setOverlayVisible(false);
    resetReading();
    doRenderGrid(allCards, spreadMode);
  };

  const shuffle = () => {
    setOverlayVisible(false);
    resetReading();
    doRenderGrid(allCards, spreadMode);
  };

  const pickCard = (card: Card) => {
    if (selectedCards.length >= spreadMode) return;
    if (selectedCards.find(s => s.card.id === card.id)) return;

    const isReversed = Math.random() < 0.3;
    const position = spreadMode === 1 ? 'Present Guidance' : POSITIONS_3[selectedCards.length];
    const newSelected = [...selectedCards, { card, isReversed, position }];
    setSelectedCards(newSelected);

    if (newSelected.length === spreadMode) {
      setGridHint(spreadMode === 1 ? card.name : 'Three cards chosen');
      resetReading();
      setOverlayVisible(true);
    } else {
      setGridHint(`Choose your ${newSelected.length === 1 ? 'second' : 'third'} card — ${POSITIONS_3[newSelected.length]}`);
    }
  };

  const hasSelected = selectedCards.length >= spreadMode;

  return (
    <>
      <h1>✦ PROPHECY ✦</h1>
      <p className="subtitle">Tarot Oracle</p>

      <div className="question-row">
        <input
          ref={questionRef}
          type="text"
          placeholder="Ask a question, or leave blank for a general reading…"
        />
      </div>

      <div className="spread-toggle">
        <button
          className={`spread-btn${spreadMode === 1 ? ' active' : ''}`}
          onClick={() => changeSpreadMode(1)}
        >
          1 Card
        </button>
        <button
          className={`spread-btn${spreadMode === 3 ? ' active' : ''}`}
          onClick={() => changeSpreadMode(3)}
        >
          3 Cards
        </button>
      </div>

      <div className="grid-controls">
        <span className="grid-hint">{gridHint}</span>
        <button className="btn-shuffle" onClick={shuffle}>Shuffle</button>
      </div>

      <div className={`card-grid${hasSelected ? ' locked' : ''}`}>
        {shuffledCards.map((card, i) => {
          const selIdx = selectedCards.findIndex(s => s.card.id === card.id);
          const isSelected = selIdx >= 0;
          const isDimmed = hasSelected && !isSelected;
          return (
            <div
              key={`${card.id}-${i}`}
              className={['grid-card', isSelected ? 'selected' : '', isDimmed ? 'dimmed' : ''].filter(Boolean).join(' ')}
              onClick={() => pickCard(card)}
            >
              {isSelected && spreadMode === 3 ? selIdx + 1 : '✦'}
            </div>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Reading overlay */}
      <div
        className={`overlay${overlayVisible ? ' visible' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}
      >
        {spreadMode === 1 ? (
          /* ── Single card modal ── */
          <div className="modal">
            <button className="btn-close" onClick={closeModal}>✕</button>

            <div className="card-scene">
              <div className={`card-flip${isFlipped ? ' flipped' : ''}`}>
                <div className="card-face card-back">✦</div>
                <div className="card-face card-front">
                  {selectedCards[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/cards/${selectedCards[0].card.id}.png`}
                      alt={selectedCards[0].card.name}
                      style={selectedCards[0].isReversed ? { transform: 'rotate(180deg)' } : undefined}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="modal-info">
              {cardInfoVisible && selectedCards[0] && (
                <div>
                  <div className="card-name">{selectedCards[0].card.name}</div>
                  <div className={`orientation ${selectedCards[0].isReversed ? 'reversed' : 'upright'}`}>
                    {selectedCards[0].isReversed ? '▼ Reversed' : '▲ Upright'}
                  </div>
                  <div className="keywords">{selectedCards[0].card.keywords.join('  ·  ')}</div>
                  <div className="meaning">
                    {selectedCards[0].isReversed ? selectedCards[0].card.reversed : selectedCards[0].card.upright}
                  </div>
                </div>
              )}
              <div className={`fortune-box${fortuneVisible ? ' visible' : ''}`}>
                <div className="fortune-label">✦ Your Reading ✦</div>
                <div className={`fortune-text${fortuneLoading ? ' loading' : ''}`}>{fortuneText}</div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Three card modal ── */
          <div className="modal three-card">
            <button className="btn-close" onClick={closeModal}>✕</button>

            <div className="three-card-row">
              {selectedCards.map((sc, idx) => (
                <div key={sc.card.id} className="spread-slot">
                  <div className="spread-position">{sc.position}</div>
                  <div className="card-scene-sm">
                    <div className={`card-flip${isFlipped ? ' flipped' : ''}`}>
                      <div className="card-face card-back">✦</div>
                      <div className="card-face card-front">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/cards/${sc.card.id}.png`}
                          alt={sc.card.name}
                          style={sc.isReversed ? { transform: 'rotate(180deg)' } : undefined}
                        />
                      </div>
                    </div>
                  </div>
                  {cardInfoVisible && (
                    <div className="spread-card-info">
                      <div className="card-name-sm">{sc.card.name}</div>
                      <div className={`orientation ${sc.isReversed ? 'reversed' : 'upright'}`}>
                        {sc.isReversed ? '▼ Reversed' : '▲ Upright'}
                      </div>
                    </div>
                  )}
                  {/* suppress unused var warning */}
                  {idx >= 0 && null}
                </div>
              ))}
            </div>

            <div className="three-card-reading">
              <div className={`fortune-box${fortuneVisible ? ' visible' : ''}`}>
                <div className="fortune-label">✦ Your Reading ✦</div>
                <div className={`fortune-text${fortuneLoading ? ' loading' : ''}`}>{fortuneText}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
