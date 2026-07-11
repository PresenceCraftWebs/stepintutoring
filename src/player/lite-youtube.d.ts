/*
 * Minimal typings for lite-youtube-embed's <lite-youtube> custom element and
 * the slice of the YouTube IFrame API we use for completion detection.
 */

interface YTPlayerStateChangeEvent {
  data: number;
}

interface YTPlayer {
  addEventListener(
    event: 'onStateChange',
    listener: (e: YTPlayerStateChangeEvent) => void,
  ): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
}

interface LiteYTEmbedElement extends HTMLElement {
  /** Available when the js-api attribute is set; resolves after activation. */
  getYTPlayer(): Promise<YTPlayer | undefined>;
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'lite-youtube': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          videoid: string;
          params?: string;
          playlabel?: string;
          'js-api'?: string;
        },
        LiteYTEmbedElement
      >;
    }
  }
}

declare module 'lite-youtube-embed';
