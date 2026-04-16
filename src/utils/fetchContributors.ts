import { type Contributor } from "~/types/contributor";

export const fetchContributors = async (owner: string, repo: string, token?: string) => {
  if (!owner || !repo) {
    throw new Error("Owner and repo are required.");
  }

  const contributors = ref<Contributor[]>([]);
  const perPage = 100;
  const maxContributors = 1000;
  let page = 1;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  while (contributors.value.length < maxContributors) {
    const endpoint =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/contributors?per_page=${perPage}&page=${page}`;

    const batch = await $fetch<Contributor[]>(endpoint, { headers });
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    for (const user of batch) {
      if (contributors.value.length >= maxContributors) {
        break;
      }
      contributors.value.push({
        id: user.id,
        login: user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        contributions: user.contributions
      });
    }

    if (batch.length < perPage) {
      break;
    }
    page += 1;
  }

  return contributors;
};
