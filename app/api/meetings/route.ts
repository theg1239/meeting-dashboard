import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/app/lib/db';

interface Meeting {
  id: string;
  title: string;
  time: string; 
  link: string;
  deleteVotes: number;
}

export async function GET() {
  try {
    const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const res = await query(`
      SELECT 
        m.id, 
        m.title, 
        m.time, 
        m.link, 
        COUNT(dv.id) AS deleteVotes
      FROM meetings m
      LEFT JOIN delete_votes dv ON m.id = dv.meeting_id
      WHERE m.time > $1
      GROUP BY m.id
      ORDER BY m.time ASC;
    `, [cutoffTime]);

    const meetings: Meeting[] = res.rows.map(row => ({
      id: row.id,
      title: row.title,
      time: new Date(row.time).toISOString(), 
      link: row.link || '', 
      deleteVotes: parseInt(row.deletevotes, 10),
    }));

    return NextResponse.json(meetings, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching meetings:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch meetings.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { title, time, link } = await request.json();

    if (!title || !time) {
      return NextResponse.json(
        { error: 'Title and time are required.' },
        { status: 400 }
      );
    }

    const meetingTime = new Date(time);
    const now = new Date();

    if (isNaN(meetingTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid time format.' },
        { status: 400 }
      );
    }

    if (meetingTime < now) {
      return NextResponse.json(
        { error: 'Meeting time cannot be in the past.' },
        { status: 400 }
      );
    }

    const id = uuidv4();

    await query(`
      INSERT INTO meetings (id, title, time, link)
      VALUES ($1, $2, $3, $4);
    `, [id, title, meetingTime.toISOString(), link || null]);

    const newMeeting: Meeting = {
      id,
      title,
      time: meetingTime.toISOString(),
      link: link || '', 
      deleteVotes: 0,
    };

    return NextResponse.json(newMeeting, { status: 201 });
  } catch (error: any) {
    console.error('Error creating meeting:', error.message);
    return NextResponse.json(
      { error: 'Failed to create meeting.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const { title, time, link } = await request.json();

    if (!title || !time) {
      return NextResponse.json(
        { error: 'Title and time are required.' },
        { status: 400 }
      );
    }

    const meetingTime = new Date(time);
    const now = new Date();

    if (isNaN(meetingTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid time format.' },
        { status: 400 }
      );
    }

    if (meetingTime < now) {
      return NextResponse.json(
        { error: 'Meeting time cannot be in the past.' },
        { status: 400 }
      );
    }

    const res = await query(`
      UPDATE meetings
      SET title = $1, time = $2, link = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, title, time, link;
    `, [title, meetingTime.toISOString(), link || null, id]);

    if (res.rowCount === 0) {
      return NextResponse.json(
        { error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    const voteRes = await query(`
      SELECT COUNT(*) AS vote_count
      FROM delete_votes
      WHERE meeting_id = $1;
    `, [id]);

    const voteCount = parseInt(voteRes.rows[0].vote_count, 10);

    const updatedMeeting: Meeting = {
      id: res.rows[0].id,
      title: res.rows[0].title,
      time: new Date(res.rows[0].time).toISOString(),
      link: res.rows[0].link || '',
      deleteVotes: voteCount, 
    };

    return NextResponse.json(updatedMeeting, { status: 200 });
  } catch (error: any) {
    console.error('Error updating meeting:', error.message);
    return NextResponse.json(
      { error: 'Failed to update meeting.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required to vote for deletion.' },
        { status: 400 }
      );
    }

    const meetingRes = await query(`
      SELECT id FROM meetings WHERE id = $1;
    `, [id]);

    if (meetingRes.rowCount === 0) {
      return NextResponse.json(
        { error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    try {
      await query(`
        INSERT INTO delete_votes (meeting_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (meeting_id, user_id) DO NOTHING;
      `, [id, userId]);
    } catch (insertError: any) {
      console.error('Error casting delete vote:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to cast delete vote.' },
        { status: 500 }
      );
    }

    const voteRes = await query(`
      SELECT COUNT(*) AS vote_count
      FROM delete_votes
      WHERE meeting_id = $1;
    `, [id]);

    const voteCount = parseInt(voteRes.rows[0].vote_count, 10);

    if (voteCount >= 5) {
      await query(`
        DELETE FROM meetings
        WHERE id = $1;
      `, [id]);

      await query(`
        DELETE FROM delete_votes
        WHERE meeting_id = $1;
      `, [id]);

      return NextResponse.json(
        { message: 'Meeting deleted successfully.' },
        { status: 200 }
      );
    } else {
      const votesNeeded = 5 - voteCount;
      return NextResponse.json(
        { message: `Vote recorded. ${votesNeeded} more vote(s) needed to delete.` },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting meeting:', error.message);
    return NextResponse.json(
      { error: 'Failed to delete meeting.' },
      { status: 500 }
    );
  }
}
