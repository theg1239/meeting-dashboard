DROP TABLE IF EXISTS delete_votes;
DROP TABLE IF EXISTS meetings;

CREATE TABLE meetings (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    link VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delete_votes (
    id SERIAL PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_meeting_user UNIQUE (meeting_id, user_id)
);

CREATE INDEX idx_meetings_time ON meetings(time);
CREATE INDEX idx_delete_votes_meeting_id ON delete_votes(meeting_id);
