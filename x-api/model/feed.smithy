$version: "2"

namespace com.twitter

list TweetList {
    member: Tweet
}

// ── Operaciones ───────────────────────────────────────
@readonly
@http(method: "GET", uri: "/v1/feed")
@auth([httpBearerAuth])
operation GetFeed {
    input := {
        @httpQuery("cursor")
        cursor: String

        @httpQuery("limit")
        limit: Integer
    }

    output := {
        @required
        tweets: TweetList

        nextCursor: String
    }

    errors: [
        UnauthorizedException
    ]
}
