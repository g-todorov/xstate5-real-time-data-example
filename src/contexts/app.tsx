"use client";

import React, { PropsWithChildren } from "react";
import { assign, setup, fromCallback, fromPromise, assertEvent } from "xstate";
import { createActorContext } from "@xstate/react";
import { onAuthStateChanged, getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  query,
  collection,
} from "firebase/firestore";

import firebaseApp from "@/firebase";

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

interface Message {
  sender: string;
  text: string;
}

const appMachine = setup({
  types: {
    context: {} as { uid: string; messages: Message[] },
    events: {} as
      | { type: "GO_TO_AUTHENTICATED"; uid: string }
      | { type: "GO_TO_UNAUTHENTICATED" }
      | { type: "END_TRANSITION" }
      | { type: "SIGN_IN" }
      | { type: "SIGN_OUT" }
      | { type: "ADD_MESSAGE" }
      | { type: "SET_MESSAGES"; messages: Message[] },
  },
  actions: {
    setUid: assign({
      uid: ({ event }) => {
        assertEvent(event, "GO_TO_AUTHENTICATED");
        return event.uid;
      },
    }),
    setMessages: assign({
      messages: ({ event }) => {
        assertEvent(event, "SET_MESSAGES");
        return event.messages;
      },
    }),
    logError({ event }) {
      console.log(event);
    },
  },
  actors: {
    userSubscriber: fromCallback(({ sendBack }) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          sendBack({ type: "GO_TO_AUTHENTICATED", uid: user.uid });
        } else {
          sendBack({ type: "GO_TO_UNAUTHENTICATED" });
        }
      });
      return () => unsubscribe();
    }),
    messagesSubscriber: fromCallback(({ sendBack }) => {
      const unsubscribe = onSnapshot(
        query(collection(firestore, "messages")),
        (querySnapshot) => {
          const messages: Message[] = [];
          querySnapshot.forEach((doc) => {
            messages.push(doc.data() as Message);
          });

          sendBack({ type: "SET_MESSAGES", messages });
        }
      );

      return () => unsubscribe();
    }),
    addMessage: fromPromise(async ({ input }: { input: { uid: string } }) => {
      await setDoc(doc(firestore, "messages", `${Date.now()}`), {
        sender: input.uid,
        text: "Lorem Ipsumm",
      });
    }),
    signIn: fromPromise(async () => {
      await signInAnonymously(auth);
    }),
    signOut: fromPromise(async () => {
      await auth.signOut();
    }),
  },
}).createMachine({
  context: { uid: "", messages: [] },
  invoke: { src: "userSubscriber" },
  on: {
    GO_TO_AUTHENTICATED: {
      actions: ["setUid"],
      target: ".authenticated",
    },
    GO_TO_UNAUTHENTICATED: { target: ".unauthenticated" },
  },
  initial: "loading",
  states: {
    loading: { tags: "loading" },
    authenticated: {
      invoke: { src: "messagesSubscriber" },
      on: {
        SIGN_OUT: { target: ".signingOut" },
        ADD_MESSAGE: { target: ".addingMessage" },
        SET_MESSAGES: { actions: ["setMessages"] },
      },
      initial: "idle",
      states: {
        idle: {},
        signingOut: {
          invoke: { src: "signOut", onDone: { target: "idle" } },
        },
        addingMessage: {
          invoke: {
            src: "addMessage",
            input: ({ context }) => {
              return { uid: context.uid };
            },
            onDone: { target: "idle" },
            onError: {
              actions: ["logError"],
            },
          },
        },
      },
    },
    unauthenticated: {
      on: {
        SIGN_IN: { target: ".signingIn" },
      },
      initial: "idle",
      states: {
        idle: {},
        signingIn: { invoke: { src: "signIn", onDone: { target: "idle" } } },
      },
    },
  },
});

export const AppContext = createActorContext(appMachine);

export function AppProvider({ children }: PropsWithChildren<{}>) {
  return <AppContext.Provider>{children}</AppContext.Provider>;
}
