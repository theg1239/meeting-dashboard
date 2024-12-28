import { NextResponse, NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/app/lib/db';

interface Meeting {
  id: string;
  title: string;
  time: string;
  link: string;
  deleteVotes: number;
}

interface MeetingRow {
  id: string;
  title: string;
  time: string;
  link: string | null;
  deletevotes: string; 
}

export async function GET(request: NextRequest) {
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

    const rows: MeetingRow[] = res.rows;

    const meetings: Meeting[] = rows.map((row) => ({
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

export async function POST(request: NextRequest) {
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
