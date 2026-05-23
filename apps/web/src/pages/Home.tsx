import { useState } from "react";
import { mockTweets } from "../data/mockData";
import type { Tweet } from "../types";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightSidebar from "../components/layout/RightSidebar";
import TweetComposer from "../components/tweet/TweetComposer";
import TweetCard from "../components/tweet/TweetCard";
import styles from "./Home.module.css";

type Tab = "foryou" | "following";

function Home() {
  const [tweets] = useState<Tweet[]>(mockTweets);
  const [activeTab, setActiveTab] = useState<Tab>("foryou");

  return (
    <div className={styles.layout}>

      <LeftSidebar />

      <main className={styles.feed}>

        {/* Sticky header with tabs */}
        <div className={styles.feedHeader}>
          <button
            className={`${styles.tab} ${activeTab === "foryou" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("foryou")}
          >
            For you
          </button>
          <button
            className={`${styles.tab} ${activeTab === "following" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("following")}
          >
            Following
          </button>
        </div>

        <TweetComposer />

        {activeTab === "foryou" && tweets.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}

        {activeTab === "following" && (
          <p className={styles.emptyMsg}>Follow some accounts to see their tweets here.</p>
        )}

      </main>

      <RightSidebar />

    </div>
  );
}

export default Home;