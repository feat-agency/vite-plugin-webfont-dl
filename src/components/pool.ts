/**
 * Maps the items with a limited number of parallel workers.
 * The results keep the order of the items.
 *
 * After the first failure no new item is started; the returned promise rejects with that failure
 * once the already running workers have finished, so nothing keeps running in the background.
 */
export async function mapPool<T, R>(
	items: T[],
	limit: number,
	worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	let failed = false;
	let failure: unknown;

	const run = async (): Promise<void> => {
		while (!failed && next < items.length) {
			const index = next++;

			try {
				results[index] = await worker(items[index], index);
			} catch (error) {
				if (!failed) {
					failed = true;
					failure = error;
				}
			}
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, run)
	);

	if (failed) {
		throw failure;
	}

	return results;
}
