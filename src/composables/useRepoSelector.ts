import { ref, computed } from "vue";

type FetchState = "idle" | "loading" | "loaded" | "error";

export function useRepoSelector(
  fetchFn: (token?: string) => Promise<string[]>,
  initialSelected: string[] = [],
) {
  const search = ref("");
  const availableRepos = ref<string[]>([]);
  const selectedRepos = ref<string[]>([...initialSelected]);
  const fetchState = ref<FetchState>("idle");
  const fetchError = ref("");

  const filteredRepos = computed(() => {
    const q = search.value.toLowerCase();
    return q
      ? availableRepos.value.filter((r) => r.toLowerCase().includes(q))
      : availableRepos.value;
  });

  const allFilteredSelected = computed(
    () =>
      filteredRepos.value.length > 0 &&
      filteredRepos.value.every((r) => selectedRepos.value.includes(r)),
  );

  function toggleRepo(repo: string): void {
    selectedRepos.value = selectedRepos.value.includes(repo)
      ? selectedRepos.value.filter((r) => r !== repo)
      : [...selectedRepos.value, repo];
  }

  function toggleAll(): void {
    selectedRepos.value = allFilteredSelected.value
      ? selectedRepos.value.filter((r) => !filteredRepos.value.includes(r))
      : [...new Set([...selectedRepos.value, ...filteredRepos.value])];
  }

  async function load(token?: string): Promise<void> {
    fetchState.value = "loading";
    fetchError.value = "";
    try {
      const repos = await fetchFn(token);
      availableRepos.value = repos;
      const repoSet = new Set(repos);
      selectedRepos.value = selectedRepos.value.filter((r) => repoSet.has(r));
      fetchState.value = "loaded";
    } catch (e) {
      fetchError.value =
        e instanceof Error ? e.message : "Failed to fetch repositories";
      fetchState.value = "error";
    }
  }

  return {
    search,
    availableRepos,
    selectedRepos,
    filteredRepos,
    allFilteredSelected,
    fetchState,
    fetchError,
    toggleRepo,
    toggleAll,
    load,
  };
}
