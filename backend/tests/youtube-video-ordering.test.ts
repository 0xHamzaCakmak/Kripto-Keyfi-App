import { describe, expect, it } from 'vitest';
import { ensureOwnChannelInEveryFive } from '../src/modules/videos/video-ordering.js';

const video = (id: number, isOwnChannel = false) => ({ id, channel: { isOwnChannel } });

describe('YouTube public video ordering', () => {
  it('promotes an own-channel video when a five-video block has none', () => {
    const ordered = ensureOwnChannelInEveryFive([
      video(1), video(2), video(3), video(4), video(5), video(6), video(7, true), video(8), video(9), video(10),
    ]);

    expect(ordered.slice(0, 5).some((item) => item.channel.isOwnChannel)).toBe(true);
    expect(ordered.map((item) => item.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('keeps natural ordering when every block already contains an own-channel video', () => {
    const input = [video(1, true), video(2), video(3), video(4), video(5), video(6, true), video(7)];
    expect(ensureOwnChannelInEveryFive(input).map((item) => item.id)).toEqual(input.map((item) => item.id));
  });

  it('does not drop or duplicate videos when no own-channel video remains', () => {
    const input = Array.from({ length: 12 }, (_, index) => video(index + 1));
    expect(ensureOwnChannelInEveryFive(input)).toEqual(input);
  });
});
