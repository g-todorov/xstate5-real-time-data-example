"use client";

import { AppContext } from "@/contexts/app";

export default function Home() {
  const state = AppContext.useSelector((snapshot) => {
    return snapshot;
  });
  const actorRef = AppContext.useActorRef();

  return (
    <main>
      <h3>Dashboard:</h3>
      <div className="content">
        <button
          className="button"
          onClick={() => {
            actorRef.send({ type: "ADD_MESSAGE" });
          }}
        >
          {state.matches({ authenticated: "addingMessage" })
            ? "...loading"
            : "Add message"}
        </button>
        <span>{state.context.messages.length}</span>
      </div>

      <button
        onClick={() => {
          actorRef.send({ type: "SIGN_OUT" });
        }}
      >
        {state.matches({ authenticated: "signingOut" })
          ? "...loading"
          : "sign out"}
      </button>
    </main>
  );
}
