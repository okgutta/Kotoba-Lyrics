import Whentil from "../../modules/Whentil.ts";

// Spotify services used by startup readiness.
const Spotify: typeof Spicetify = (globalThis as any).Spicetify;

// Spotify Ready Promise — waits (16ms polling via Whentil) until both services
// exist. The previous rAF + setTimeout(0) chain is replaced by Whentil, which
// also swallows transient getter throws and keeps polling.
const OnSpotifyReady = new Promise<void>((resolve) => {
  Whentil.When(
    () => Spotify.Platform && Spotify.CosmosAsync,
    () => resolve()
  );
});

const Platform = {
  OnSpotifyReady,
};

export default Platform;
