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

export default function TarotApp() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [shuffledCards, setShuffledCards] = useState<Card[]>([]);
  const [hasSelected, setHasSelected] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [gridHint, setGridHint] = useState('The cards await. Choose one.');
  const [error, setError] = useState('');
  const questionRef = useRef<HTMLInputElement>(null);

  // Reading overlay state
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
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

  // Flip sequence: fires when image finishes loading
  useEffect(() => {
    if (!imageLoaded) return;
    const t1 = setTimeout(() => setIsFlipped(true), 300);
    const t2 = setTimeout(() => setCardInfoVisible(true), 300 + 700 + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [imageLoaded]);

  const getFortune = useCallback(async (card: Card, orientation: string, signal: AbortSignal) => {
    setFortuneText('');
    setFortuneLoading(true);
    setFortuneVisible(true);

    const question = questionRef.current?.value.trim() ?? '';

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, orientation, question }),
        signal,
      });

      setFortuneLoading(false);

      if (!res.ok || !res.body) {
        setFortuneText(orientation === 'reversed' ? card.reversed : card.upright);
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
      setFortuneText(orientation === 'reversed' ? card.reversed : card.upright);
    }
  }, []);

  // Start fortune streaming after card info becomes visible
  useEffect(() => {
    if (!cardInfoVisible || !selectedCard) return;
    const controller = new AbortController();
    getFortune(selectedCard, isReversed ? 'reversed' : 'upright', controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardInfoVisible]);

  const resetReading = () => {
    setImageLoaded(false);
    setIsFlipped(false);
    setCardInfoVisible(false);
    setFortuneVisible(false);
    setFortuneLoading(false);
    setFortuneText('');
  };

  const doRenderGrid = useCallback((cards: Card[]) => {
    setHasSelected(false);
    setSelectedCard(null);
    setShuffledCards([...cards].sort(() => Math.random() - 0.5));
    setGridHint('The cards await. Choose one.');
    setError('');
  }, []);

  const closeModal = () => {
    setOverlayVisible(false);
    resetReading();
    doRenderGrid(allCards);
  };

  const shuffle = () => {
    setOverlayVisible(false);
    resetReading();
    doRenderGrid(allCards);
  };

  const pickCard = (card: Card) => {
    if (hasSelected) return;
    setHasSelected(true);
    const reversed = Math.random() < 0.3;
    setIsReversed(reversed);
    setSelectedCard(card);
    setGridHint(card.name);
    resetReading();
    setOverlayVisible(true);
  };

  const orientation = isReversed ? 'reversed' : 'upright';
  const meaning = selectedCard ? (isReversed ? selectedCard.reversed : selectedCard.upright) : '';

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

      <div className="grid-controls">
        <span className="grid-hint">{gridHint}</span>
        <button className="btn-shuffle" onClick={shuffle}>Shuffle</button>
      </div>

      <div className={`card-grid${hasSelected ? ' locked' : ''}`}>
        {shuffledCards.map((card, i) => (
          <div
            key={`${card.id}-${i}`}
            className={[
              'grid-card',
              card.id === selectedCard?.id ? 'selected' : '',
              hasSelected && card.id !== selectedCard?.id ? 'dimmed' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => pickCard(card)}
          >
            ✦
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Reading overlay */}
      <div
        className={`overlay${overlayVisible ? ' visible' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}
      >
        <div className="modal">
          <button className="btn-close" onClick={closeModal}>✕</button>

          <div className="card-scene">
            <div className={`card-flip${isFlipped ? ' flipped' : ''}`}>
              <div className="card-face card-back">✦</div>
              <div className="card-face card-front">
                {selectedCard && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/cards/${selectedCard.id}.png`}
                    alt={selectedCard.name}
                    style={isReversed ? { transform: 'rotate(180deg)' } : undefined}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="modal-info">
            {cardInfoVisible && selectedCard && (
              <div>
                <div className="card-name">{selectedCard.name}</div>
                <div className={`orientation ${orientation}`}>
                  {isReversed ? '▼ Reversed' : '▲ Upright'}
                </div>
                <div className="keywords">{selectedCard.keywords.join('  ·  ')}</div>
                <div className="meaning">{meaning}</div>
              </div>
            )}

            <div className={`fortune-box${fortuneVisible ? ' visible' : ''}`}>
              <div className="fortune-label">✦ Your Reading ✦</div>
              <div className={`fortune-text${fortuneLoading ? ' loading' : ''}`}>
                {fortuneText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
