/**
 * Whether the East Coast Blinds production cutover (the Apache vhost swap) has happened.
 * It is still open in the client's tracker, so copy and the case study diagram describe the
 * plan, not an event. When it is closed: set this to true, rewrite the copy in the past
 * tense, and the diagram switches to the post-cutover drawing. Read by
 * src/components/diagrams/EastCoastBlinds.astro and tests/east-coast-blinds-story.test.mjs.
 */
export const CUTOVER_DONE = false;
