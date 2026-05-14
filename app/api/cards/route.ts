import { NextResponse } from 'next/server';
import cardsData from '@/lib/tarot_cards.json';

export function GET() {
  return NextResponse.json(
    cardsData.cards.map(card => ({
      id: card.id,
      name: card.name,
      arcana: card.arcana,
      suit: card.suit ?? null,
      keywords: card.keywords,
      upright: card.upright,
      reversed: card.reversed,
    }))
  );
}
