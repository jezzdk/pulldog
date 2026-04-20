import { ref, watch, type Ref } from "vue";

export const REPOS_KEY = "pulldog-repos";

function parseRepos(text: string): string[] {
  return text
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
}

interface UsePersistedReposReturn {
  reposText: Ref<string>;
  repoList: Ref<string[]>;
  save: (text: string) => void;
  saveList: (repos: string[]) => void;
  clear: () => void;
}

export function usePersistedRepos(): UsePersistedReposReturn {
  const stored = localStorage.getItem(REPOS_KEY) ?? "";
  const reposText = ref<string>(stored);
  const repoList = ref<string[]>(parseRepos(stored));

  function save(text: string): void {
    reposText.value = text;
    repoList.value = parseRepos(text);
    localStorage.setItem(REPOS_KEY, text);
  }

  function saveList(repos: string[]): void {
    save(repos.join("\n"));
  }

  function clear(): void {
    reposText.value = "";
    repoList.value = [];
    localStorage.removeItem(REPOS_KEY);
  }

  watch(reposText, (val) => {
    repoList.value = parseRepos(val);
    localStorage.setItem(REPOS_KEY, val);
  });

  return { reposText, repoList, save, saveList, clear };
}
