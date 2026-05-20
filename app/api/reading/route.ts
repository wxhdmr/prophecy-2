import Anthropic from '@anthropic-ai/sdk';
import cardsData from '@/lib/tarot_cards.json';

export const maxDuration = 60;

const client = new Anthropic();

const ORACLE_SYSTEM_PROMPT = `You are a mystical tarot oracle with deep wisdom drawn from centuries of esoteric tradition. \
When a seeker draws a card, you deliver a concise, evocative reading (3-5 sentences) that:
- Speaks directly to the seeker in second person
- Interprets the card's symbolism and energy in plain but poetic language
- Ties the reading to their specific question when one is provided
- Reflects the card's upright or reversed energy accurately
- Ends with a single resonant sentence of guidance

Stay in character. Be atmospheric yet grounded. Never list bullet points — flow as natural prose.`;

const THREE_CARD_ORACLE_PROMPT = `You are a mystical tarot oracle with deep wisdom drawn from centuries of esoteric tradition. \
When a seeker draws three cards in a Past / Present / Future spread, you deliver a flowing reading (5-7 sentences) that:
- Speaks directly to the seeker in second person
- Weaves all three cards into a single cohesive narrative — do not treat them as separate readings
- Traces the journey from past energies through the present moment into the future
- Ties the reading to their specific question when one is provided
- Ends with a single resonant sentence of guidance

Stay in character. Be atmospheric yet grounded. Never list bullet points — flow as natural prose.`;

interface SingleCardBody {
  card_id: string;
  orientation: string;
  question: string;
}

interface ThreeCardBody {
  cards: Array<{ card_id: string; orientation: string; position: string }>;
  question: string;
}

export async function POST(req: Request) {
  const body: SingleCardBody | ThreeCardBody = await req.json();
  const { question } = body;

  let systemPrompt: string;
  let userMessage: string;

  if ('cards' in body) {
    // Three-card spread
    const cardLines = body.cards.map(({ card_id, orientation, position }) => {
      const card = cardsData.cards.find(c => c.id === card_id);
      if (!card) return null;
      const isReversed = orientation === 'reversed';
      const meaning = isReversed ? card.reversed : card.upright;
      return `[${position}] ${card.name} (${orientation})\nKeywords: ${card.keywords.join(', ')}\nMeaning: ${meaning}`;
    }).filter(Boolean);

    if (cardLines.length === 0) return new Response('Cards not found', { status: 404 });

    const questionPart = question ? `\nThe seeker asks: "${question}"` : '';
    systemPrompt = THREE_CARD_ORACLE_PROMPT;
    userMessage =
      `Three-card spread (Past / Present / Future):\n\n${cardLines.join('\n\n')}${questionPart}`;
  } else {
    // Single card
    const card = cardsData.cards.find(c => c.id === body.card_id);
    if (!card) return new Response('Card not found', { status: 404 });

    const isReversed = body.orientation === 'reversed';
    const meaning = isReversed ? card.reversed : card.upright;
    const questionPart = question ? `\nThe seeker asks: "${question}"` : '';
    systemPrompt = ORACLE_SYSTEM_PROMPT;
    userMessage =
      `Card drawn: ${card.name} (${body.orientation})${questionPart}\n` +
      `Keywords: ${card.keywords.join(', ')}\n` +
      `Core meaning: ${meaning}`;
  }

  try {
    const stream = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 600,
      stream: true,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`The oracle is silent: ${e}`));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError && e.status === 401) {
      return new Response('The oracle is unavailable — an API key is required.');
    }
    return new Response(`The oracle is silent: ${e}`);
  }
}
