// O projeto Supabase tem um teto de 1000 linhas por requisição (db-max-rows
// do PostgREST) — .limit(N) no cliente só consegue PEDIR MENOS que isso,
// nunca mais. Qualquer consulta que possa passar de 1000 linhas (agregando
// várias pessoas ao longo de um período) precisa paginar de verdade com
// .range(), senão o resto simplesmente some da resposta sem erro nenhum.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
