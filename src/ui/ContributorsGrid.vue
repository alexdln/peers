<script setup lang="ts">
import {
  downloadSvgString,
  fetchImageAsDataUrlSafe,
  rasterizeSvgStringToPng
} from "~/utils/avatarGridSvg";
import { fetchContributors } from "~/utils/fetchContributors";

const svgRef = ref<SVGSVGElement | null>(null);
const error = ref("");
const avatarDataUrls = ref<string[]>([]);
const columns = ref(32);
const roundRadius = ref(48);
const cellGap = ref(12);
const svgPadding = ref(12);
const avatarSize = ref(96);
const backgroundColor = ref("#ffffff");
const transparent = ref(false);

const normalizedColumns = computed(() => Math.max(1, Number(columns.value) || 1));
const gridRows = computed(() =>
  Math.max(1, Math.ceil(avatarDataUrls.value.length / normalizedColumns.value))
);
const svgWidth = computed(() => {
  return svgPadding.value * 2 + normalizedColumns.value * avatarSize.value + (normalizedColumns.value - 1) * cellGap.value;
});
const svgHeight = computed(() => {
  return svgPadding.value * 2 + gridRows.value * avatarSize.value + (gridRows.value - 1) * cellGap.value;
});

const getAvatarX = (index: number) => {
  return svgPadding.value + (index % normalizedColumns.value) * (avatarSize.value + cellGap.value);
};

const getAvatarY = (index: number) => {
  return svgPadding.value + Math.floor(index / normalizedColumns.value) * (avatarSize.value + cellGap.value);
}

const loading = ref(false);

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
    const includeBots = Boolean(formData.get("includeBots"));
    const includeAnon = Boolean(formData.get("includeAnon"));

    if (!owner || !repo) return;

    const contributorsList = await fetchContributors(owner, repo, { token, includeBots, includeAnon });
    for (let i = 0; i < contributorsList.value.length; i += 10) {
      const chunk = contributorsList.value.slice(i, i + 10);
      const chunkAvatarDataUrls = await Promise.all(chunk.map(({ avatar_url }) => fetchImageAsDataUrlSafe(avatar_url)));
      avatarDataUrls.value.push(...chunkAvatarDataUrls);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load contributors.";
  } finally {
    loading.value = false;
  }
}

const loadingSvg = ref(false);

const downloadSvg = async () => {
  if (!avatarDataUrls.value.length) {
    return;
  }
  loadingSvg.value = true;
  error.value = "";
  try {
    const svg = svgRef.value?.outerHTML;

    if (!svg) return;

    downloadSvgString(svg, "contributors.svg");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "SVG export failed.";
  } finally {
    loadingSvg.value = false;
  }
}

const loadingPng = ref(false);

const downloadPng = async () => {
  if (!avatarDataUrls.value.length) {
    return;
  }

  loadingPng.value = true;
  error.value = "";
  try {
    const svg = svgRef.value?.outerHTML;

    if (!svg) return;

    await rasterizeSvgStringToPng(svg, "contributors.png", transparent.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "PNG export failed.";
  } finally {
    loadingPng.value = false;
  }
}
</script>

<template>
  <main class="container">
    <h1 class="heading">GitHub Contributors Grid</h1>

    <form class="controls" @submit.prevent="loadContributors">
      <div class="form-fields">
        <label class="label">
          Owner
          <input class="text-input" placeholder="nuxt" name="owner" value="npmx-dev" required />
        </label>
        <label class="label">
          Repo
          <input class="text-input" placeholder="nuxt" name="repo" value="npmx.dev" required />
        </label>
        <label class="label">
          Token
          <input class="text-input" placeholder="ghp_1234567890" name="token" />
        </label>
        <label class="checkbox-label">
          <input class="checkbox-input" type="checkbox" name="includeBots" />
          Include Bots
        </label>
        <label class="checkbox-label">
          <input class="checkbox-input" type="checkbox" name="includeAnon" />
          Include Anon
        </label>
      </div>
      <button class="button submit-button" :disabled="loading" type="submit">
        {{ loading ? "Loading..." : "Load Contributors" }}
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="grid" v-if="avatarDataUrls.length">
      <div class="customisation">
        <label class="label">
          Columns
          <input class="text-input" v-model.number="columns" type="number" min="1" name="columns" />
        </label>
        <label class="label">
          Round Radius
          <input class="text-input" v-model.number="roundRadius" type="number" min="0" name="roundRadius" />
        </label>
        <label class="label">
          Cell Gap
          <input class="text-input" v-model.number="cellGap" type="number" min="0" name="cellGap" />
        </label>
        <label class="checkbox-label">
          <input class="checkbox-input" v-model="transparent" type="checkbox" name="transparent" />
          Transparent
        </label>
        <label class="label" v-if="!transparent">
          Background Color
          <input class="color-input" v-model="backgroundColor" type="color" name="backgroundColor" />
        </label>
      </div>
      <svg
        v-if="avatarDataUrls.length"
        class="avatar-grid-svg"
        :width="svgWidth"
        :height="svgHeight"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        ref="svgRef"
        role="img"
        :style="{ backgroundColor: transparent ? 'transparent' : backgroundColor || '#ffffff' }"
      >
        <defs>
          <clipPath v-for="(avatarDataUrl, index) in avatarDataUrls" :id="`clip-${index}`" :key="avatarDataUrl">
            <rect
              :x="getAvatarX(index)"
              :y="getAvatarY(index)"
              :width="avatarSize"
              :height="avatarSize"
              :rx="roundRadius"
            />
          </clipPath>
        </defs>

        <image
          v-for="(avatarDataUrl, index) in avatarDataUrls"
          :key="avatarDataUrl"
          :href="avatarDataUrl"
          :x="getAvatarX(index)"
          :y="getAvatarY(index)"
          :width="avatarSize"
          :height="avatarSize"
          preserveAspectRatio="xMidYMid slice"
          :clip-path="`url(#clip-${index})`"
        />
      </svg>

      <div class="download-actions">
        <button class="button" type="button" :disabled="avatarDataUrls.length === 0 || loadingSvg" @click="downloadSvg">
          {{ loadingSvg ? "Preparing…" : "Download SVG" }}
        </button>
        <button class="button" type="button" :disabled="avatarDataUrls.length === 0 || loadingPng" @click="downloadPng">
          {{ loadingPng ? "Preparing…" : "Download PNG" }}
        </button>
      </div>
      <p>
        Total contributors: {{ avatarDataUrls.length }}
      </p>
    </section>
  </main>
</template>

<style>
.container {
  max-width: 1080px;
  margin: 2rem auto;
  padding: 0 1rem 2rem;
  color: #0f172a;
}

.heading {
  margin-bottom: 1rem;
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

.download-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.customisation {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

.avatar-grid-svg {
  margin-top: 1rem;
}

.label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0;
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

.color-input {
  height: 2.25rem;
  border-radius: 0.5rem;
  border: 2px solid #2b2e32;
  background: #fff;
  box-sizing: border-box;
}

.text-input:hover,
.color-input:hover,
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

.avatar-grid-svg {
  max-width: 100%;
  height: auto;
}
</style>
