import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';

type PlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type PlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars: Record<string, number>;
    events: { onReady: (event: { target: PlayerInstance }) => void };
  },
) => PlayerInstance;

declare global {
  interface Window {
    YT?: { Player: PlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubePlayerHandle = {
  seekTo: (seconds: number) => void;
};

type YouTubePlayerProps = {
  videoId: string;
  title: string;
  onTimeChange?: (seconds: number) => void;
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, title, onTimeChange }, ref) => {
    const reactId = useId();
    const elementId = `youtube-player-${reactId.replace(/:/g, '')}`;
    const playerRef = useRef<PlayerInstance | null>(null);
    const timerRef = useRef<number | null>(null);
    const onTimeChangeRef = useRef(onTimeChange);

    useEffect(() => {
      onTimeChangeRef.current = onTimeChange;
    }, [onTimeChange]);

    useImperativeHandle(ref, () => ({
      seekTo(seconds: number) {
        playerRef.current?.seekTo(seconds, true);
        playerRef.current?.playVideo();
      },
    }));

    useEffect(() => {
      let cancelled = false;

      const createPlayer = () => {
        if (cancelled || !window.YT || playerRef.current) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              timerRef.current = window.setInterval(() => {
                const time = playerRef.current?.getCurrentTime();
                if (typeof time === 'number') onTimeChangeRef.current?.(time);
              }, 750);
            },
          },
        });
      };

      if (window.YT?.Player) {
        createPlayer();
      } else {
        const existingScript = document.querySelector<HTMLScriptElement>(
          'script[src="https://www.youtube.com/iframe_api"]',
        );
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          previousReady?.();
          createPlayer();
        };
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://www.youtube.com/iframe_api';
          script.async = true;
          document.head.appendChild(script);
        }
      }

      return () => {
        cancelled = true;
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [elementId, videoId]);

    return (
      <div
        className="youtube-frame h-full min-h-[220px] w-full overflow-hidden rounded-2xl bg-black"
        aria-label={`YouTube player for ${title}`}
      >
        <div id={elementId} className="h-full w-full" />
      </div>
    );
  },
);

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;
