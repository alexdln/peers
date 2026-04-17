<script setup lang="ts">
import { fetchImageAsDataUrlSafe } from "~/utils/avatarGridSvg";
import { fetchContributors } from "~/utils/fetchContributors";

interface MemoryCard {
  id: string;
  pairId: number;
  imageUrl: string;
  matched: boolean;
  faceUp: boolean;
  showImage: boolean;
}

const error = ref("");
const avatarDataUrls = ref<string[]>([]);
const loading = ref(false);

const memoryCards = ref<MemoryCard[]>([]);
const gameWon = ref(false);
const inputLocked = ref(false);
let firstPick: MemoryCard | null = null;

const pairProgress = computed(() => {
  const total = memoryCards.value.length;
  if (!total) return { found: 0, totalPairs: 0 };
  const found = memoryCards.value.filter((c) => c.matched).length / 2;
  return { found, totalPairs: total / 2 };
});

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildDeck = () => {
  const urls = avatarDataUrls.value;
  const slice = urls.slice(0, urls.length);
  const deck: MemoryCard[] = [];
  for (let pairId = 0; pairId < slice.length; pairId++) {
    const imageUrl = slice[pairId]!;
    deck.push({
      id: `${pairId}-a-${crypto.randomUUID()}`,
      pairId,
      imageUrl,
      matched: false,
      faceUp: false,
      showImage: false
    });
    deck.push({
      id: `${pairId}-b-${crypto.randomUUID()}`,
      pairId,
      imageUrl,
      matched: false,
      faceUp: false,
      showImage: false
    });
  }
  memoryCards.value = shuffle(deck);
  gameWon.value = false;
  inputLocked.value = false;
  firstPick = null;
};

const loadContributors = async (event: Event) => {
  event.preventDefault();
  loading.value = true;
  error.value = "";
  avatarDataUrls.value = [];

  try {
    const formData = new FormData(event.target as HTMLFormElement);
    const owner = formData.get("owner") as string;
    const repo = formData.get("repo") as string;
    const token = formData.get("token") as string;

    if (!owner || !repo) return;

    const contributorsList = await fetchContributors(owner, repo, { token });
    for (let i = 0; i < contributorsList.value.length; i += 10) {
      const chunk = contributorsList.value.slice(i, i + 10);
      const chunkAvatarDataUrls = await Promise.all(chunk.map(({ avatar_url }) => fetchImageAsDataUrlSafe(avatar_url)));
      avatarDataUrls.value.push(...chunkAvatarDataUrls);
    }
    buildDeck();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load contributors.";
  } finally {
    loading.value = false;
  }
};

const flipCard = (card: MemoryCard) => {
  if (inputLocked.value || card.matched || card.faceUp) return;

  card.faceUp = true;
  card.showImage = true;

  if (!firstPick) {
    firstPick = card;
    return;
  }

  if (firstPick.id === card.id) return;

  if (firstPick.pairId === card.pairId) {
    firstPick.matched = true;
    card.matched = true;
    firstPick = null;
    const allMatched = memoryCards.value.every((c) => c.matched);
    if (allMatched) {
      gameWon.value = true;
    }
    return;
  }

  inputLocked.value = true;
  const a = firstPick;
  const b = card;
  firstPick = null;

  window.setTimeout(() => {
    a.faceUp = false;
    b.faceUp = false;
    inputLocked.value = false;
  }, 700);
};

const onCardTransitionEnd = (card: MemoryCard, event: TransitionEvent) => {
  if (event.propertyName !== "transform") return;
  if (!card.faceUp && !card.matched) {
    card.showImage = false;
  }
};

const playAgain = buildDeck;
</script>

<template>
  <main class="container">
    <h1 class="heading">Contributor memory</h1>
    <p>
      Load a repo’s contributors, then find every matching pair. Flip two cards at a time; matches stay face up.
    </p>

    <form class="controls" @submit.prevent="loadContributors">
      <div class="form-fields">
        <label class="label">
          Owner *
          <input class="text-input" placeholder="nuxt" name="owner" value="npmx-dev" required />
        </label>
        <label class="label">
          Repo *
          <input class="text-input" placeholder="nuxt" name="repo" value="npmx.dev" required />
        </label>
        <label class="label">
          Token
          <input class="text-input" placeholder="ghp_1234567890" name="token" />
        </label>
      </div>
      <button class="button submit-button" :disabled="loading" type="submit">
        {{ loading ? "Loading..." : "Load contributors" }}
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="memoryCards.length" class="game-section">
      <div class="game-toolbar">
        <p class="stats">Pairs: {{ pairProgress.found }} / {{ pairProgress.totalPairs }}</p>
        <button class="button" type="button" @click="playAgain">Shuffle &amp; play again</button>
      </div>

      <div
        class="memory-grid"
        :class="{ 'memory-grid--locked': inputLocked }"
        :aria-busy="inputLocked"
      >
        <button
          v-for="card in memoryCards"
          :key="card.id"
          type="button"
          class="memory-card"
          :class="{
            'memory-card--flipped': card.faceUp || card.matched,
            'memory-card--matched': card.matched
          }"
          :disabled="card.matched || inputLocked"
          :aria-pressed="card.faceUp || card.matched"
          :aria-label="card.matched || card.faceUp ? 'Matched contributor' : 'Face-down card'"
          @click="flipCard(card)"
        >
          <span class="memory-card-inner" @transitionend="onCardTransitionEnd(card, $event)">
            <span class="memory-card-face memory-card-back" aria-hidden="true">
              <span class="memory-card-pattern" />
            </span>
            <span class="memory-card-face memory-card-front">
              <img class="memory-card-img" :src="card.imageUrl" alt="" v-if="card.showImage" decoding="async" />
            </span>
          </span>
        </button>
      </div>

      <transition name="win">
        <p v-if="gameWon" class="win-banner" role="status">All pairs found — nice work.</p>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.container {
  max-width: 1180px;
  margin: 2rem auto;
  padding: 0 1rem 2rem;
  color: #0f172a;
}

.heading {
  margin-bottom: 0.5rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.text-input {
  width: 160px;
}

.text-input,
.button {
  font: inherit;
  font-size: 1rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  border: 2px solid #2b2e32;
  padding: 0 0.75rem;
  background: #fff;
  box-sizing: border-box;
}

.text-input:hover,
.button:hover {
  border-color: #105dca;
}

.button {
  cursor: pointer;
  font-weight: 600;
  text-wrap: nowrap;
}

.submit-button {
  background: #212121;
  color: #fff;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #b91c1c;
}

.game-section {
  margin-top: 1.5rem;
}

.game-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stats {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.memory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
  gap: 0.1rem;
  max-width: 100%;
}

.memory-grid--locked {
  pointer-events: none;
}

.memory-card {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.65rem;
  perspective: 800px;
  -webkit-tap-highlight-color: transparent;
}

.memory-card:disabled {
  cursor: default;
}

.memory-card--matched:disabled {
  opacity: 1;
}

.memory-card-inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1);
  border-radius: 0.65rem;
}

.memory-card--flipped .memory-card-inner {
  transform: rotateY(180deg);
}

.memory-card-face {
  position: absolute;
  inset: 0;
  border-radius: 0.65rem;
  backface-visibility: hidden;
  overflow: hidden;
  box-shadow: 0 2px 8px rgb(15 23 42 / 12%);
  border: 1px solid #e2e8f0;
}

.memory-card-back {
  transform: rotateY(0deg);
  background: linear-gradient(145deg, #1e293b 0%, #334155 50%, #1e293b 100%);
}

.memory-card-back:hover {
  background: linear-gradient(145deg, #32486c 0%, #334155 50%, #425a7f 100%);
}

.memory-card-pattern {
  position: absolute;
  inset: 12%;
  border-radius: 0.35rem;
  background:
    repeating-linear-gradient(
      -45deg,
      rgb(255 255 255 / 0.08) 0,
      rgb(255 255 255 / 0.08) 6px,
      transparent 6px,
      transparent 12px
    );
}

.memory-card-front {
  transform: rotateY(180deg);
  background: #f8fafc;
}

.memory-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.memory-card--matched .memory-card-face {
  border-color: #22c55e;
  box-shadow: 0 0 0 2px rgb(34 197 94 / 0.35), 0 4px 12px rgb(34 197 94 / 0.2);
}

.memory-card--matched .memory-card-inner {
  transform: rotateY(180deg);
}

.win-banner {
  margin: 1.25rem 0 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: linear-gradient(90deg, #ecfdf5, #d1fae5);
  border: 1px solid #6ee7b7;
  color: #065f46;
  font-weight: 600;
  text-align: center;
}

.win-enter-active,
.win-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.win-enter-from,
.win-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
