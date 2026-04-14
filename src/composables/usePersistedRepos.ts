// composables/usePersistedRepos.ts
// Persists the repo list to localStorage so it survives page refreshes.

import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'pulldog-repos'

interface UsePersistedReposReturn {
  reposText: Ref<string>
  repoList:  Ref<string[]>
  save:      (text: string) => void
  clear:     () => void
}

export function usePersistedRepos(): UsePersistedReposReturn {
  // Seed from localStorage on first load
  const stored = localStorage.getItem(STORAGE_KEY) ?? ''
  const reposText = ref<string>(stored)

  const repoList = ref<string[]>(
    stored.split('\n').map(r => r.trim()).filter(Boolean),
  )

  function save(text: string): void {
    reposText.value = text
    repoList.value  = text.split('\n').map(r => r.trim()).filter(Boolean)
    localStorage.setItem(STORAGE_KEY, text)
  }

  function clear(): void {
    reposText.value = ''
    repoList.value  = []
    localStorage.removeItem(STORAGE_KEY)
  }

  // Keep repoList in sync if reposText is mutated directly
  watch(reposText, val => {
    repoList.value = val.split('\n').map(r => r.trim()).filter(Boolean)
    localStorage.setItem(STORAGE_KEY, val)
  })

  return { reposText, repoList, save, clear }
}
