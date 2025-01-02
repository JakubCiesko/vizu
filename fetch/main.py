from fetch_data import fetch
from merge_csv import merge, memory_effective_merge

if __name__ == "__main__":
    fetch(break_loop_after_fails=2)
    memory_effective_merge()
