import { mapPool } from 'src/components';
import { describe, expect, it } from 'vitest';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('pool', () => {
	it('should keep the order of the items', async () => {
		const results = await mapPool([30, 1, 20, 5], 4, async (ms) => {
			await wait(ms);

			return ms * 2;
		});

		expect(results).deep.eq([60, 2, 40, 10]);
	});

	it('should not run more workers than the limit', async () => {
		let running = 0;
		let maxRunning = 0;

		await mapPool(Array.from({ length: 20 }, (_, index) => index), 3, async () => {
			running++;
			maxRunning = Math.max(maxRunning, running);

			await wait(2);

			running--;
		});

		expect(maxRunning).eq(3);
	});

	it('should handle an empty list', async () => {
		expect(await mapPool([], 6, () => Promise.resolve(1))).deep.eq([]);
	});

	it('should treat a non-positive limit as 1', async () => {
		expect(await mapPool([1, 2, 3], 0, (item) => Promise.resolve(item))).deep.eq([1, 2, 3]);
	});

	it('should reject and stop starting new items after a failure', async () => {
		const started: number[] = [];

		await expect(
			mapPool([1, 2, 3, 4, 5, 6], 2, async (item) => {
				started.push(item);

				await wait(2);

				if (item === 2) {
					throw new Error('failed');
				}
			})
		).rejects.toThrow('failed');

		await wait(20);

		// 1 and 2 run first, 3 may have started before 2 failed, the rest never starts
		expect(started.length).lessThanOrEqual(3);
		expect(started).not.contain(6);
	});

	it('should wait for the running workers before rejecting', async () => {
		let finished = 0;

		await expect(
			mapPool([1, 30, 30], 3, async (ms) => {
				await wait(ms);

				if (ms === 1) {
					throw new Error('failed');
				}

				finished++;
			})
		).rejects.toThrow('failed');

		// nothing keeps running in the background
		expect(finished).eq(2);
	});

	it('should reject with the first failure', async () => {
		await expect(
			mapPool([20, 1], 2, async (ms) => {
				await wait(ms);

				throw new Error('failed after ' + ms);
			})
		).rejects.toThrow('failed after 1');
	});
});
