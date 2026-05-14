import Anthropic from '@anthropic-ai/sdk';
import cardsData from '@/lib/tarot_cards.json';

const client = new Anthropic();

const ORACLE_SYSTEM_PROMPT = `You are a mystical tarot oracle with deep wisdom drawn from centuries of esoteric tradition. \
When a seeker draws a card, you deliver a concise, evocative reading (3-5 sentences) that:
- Speaks directly to the seeker in second person
- Interprets the card's symbolism and energy in plain but poetic language
- Ties the reading to their specific question when one is provided
- Reflects the card's upright or reversed energy accurately
- Ends with a single resonant sentence of guidance

Stay in character. Be atmospheric yet grounded. Never list bullet points — flow as natural prose.`;

export async function POST(req: Request) {
  const { card_id, orientation, question } = await req.json();

  const card = cardsData.cards.find(c => c.id === card_id);
  if (!card) return new Response('Card not found', { status: 404 });

  const isReversed = orientation === 'reversed';
  const meaning = isReversed ? card.reversed : card.upright;
  const questionPart = question ? `\nThe seeker asks: "${question}"` : '';
  const userMessage =
    `Card drawn: ${card.name} (${orientation})${questionPart}\n` +
    `Keywords: ${card.keywords.join(', ')}\n` +
    `Core meaning: ${meaning}`;

  try {
    const stream = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      stream: true,
      system: [
        {
          type: 'text',
          text: ORACLE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
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
