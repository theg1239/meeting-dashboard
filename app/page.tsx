'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useSWR from 'swr'
import Button from '@/app/components/ui/button'
import { v4 as uuidv4 } from 'uuid'
import { format, parseISO } from 'date-fns'

interface Meeting {
  id: string
  title: string
  time: string 
  link: string
  deleteVotes: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function Dashboard() {
  const { data: meetings, error, mutate } = useSWR<Meeting[]>('/api/meetings', fetcher, {
    refreshInterval: 5000,
  })

  const [currentMeetingIndex, setCurrentMeetingIndex] = useState<number | null>(null)
  const [isAddingNewMeeting, setIsAddingNewMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState<Omit<Meeting, 'id' | 'deleteVotes'>>({
    title: '',
    time: '',
    link: '',
  })
  const [userId, setUserId] = useState<string>('')

  const [localTitle, setLocalTitle] = useState<string>('')
  const [localTime, setLocalTime] = useState<string>('')
  const [localLink, setLocalLink] = useState<string>('')
  const [timeError, setTimeError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')

  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let storedUserId = getCookie('user-id')
    if (!storedUserId) {
      storedUserId = uuidv4()
      setCookie('user-id', storedUserId, 365)
    }
    setUserId(storedUserId)
  }, [])

  useEffect(() => {
    if (meetings && meetings.length > 0 && !isAddingNewMeeting) {
      if (currentMeetingIndex === null || currentMeetingIndex >= meetings.length) {
        setCurrentMeetingIndex(0)
      }
    } else if (meetings && meetings.length === 0) {
      setCurrentMeetingIndex(null)
    }
  }, [meetings, isAddingNewMeeting, currentMeetingIndex])

  const currentMeeting: Meeting = isAddingNewMeeting
    ? { id: 'temp', ...newMeeting, deleteVotes: 0 }
    : currentMeetingIndex !== null && meetings && meetings[currentMeetingIndex]
    ? meetings[currentMeetingIndex]
    : { id: 'placeholder', title: 'No meetings scheduled', time: '', link: '', deleteVotes: 0 }

  useEffect(() => {
    if (!isAddingNewMeeting && currentMeeting.id !== 'placeholder') {
      setLocalTitle(currentMeeting.title)
      setLocalTime(formatToDateTimeLocal(currentMeeting.time))
      setLocalLink(currentMeeting.link)
      setTimeError('')
      setSuccessMessage('')
    } else if (!isAddingNewMeeting && currentMeeting.id === 'placeholder') {
      setLocalTitle('')
      setLocalTime('')
      setLocalLink('')
      setTimeError('')
      setSuccessMessage('')
    }
  }, [currentMeeting, isAddingNewMeeting])

  const handleEdit = (field: keyof Omit<Meeting, 'id' | 'deleteVotes'>, value: string) => {
    if (isAddingNewMeeting) {
      setNewMeeting((prev) => ({ ...prev, [field]: value }))
    } else if (currentMeetingIndex !== null && meetings) {
      if (field === 'title') {
        setLocalTitle(value)
      } else if (field === 'time') {
        setLocalTime(value)
      } else if (field === 'link') {
        setLocalLink(value)
      }

      let updatedMeeting: Meeting = { ...currentMeeting }

      if (field === 'title') {
        updatedMeeting.title = value
      } else if (field === 'time') {
        updatedMeeting.time = new Date(value).toISOString()
      } else if (field === 'link') {
        updatedMeeting.link = value
      }

      if (field === 'time') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          setTimeError('Invalid date and time.')
        } else if (date < new Date()) {
          setTimeError('Meeting time cannot be in the past.')
        } else {
          setTimeError('')
        }
      }

      if (!(field === 'time' && (isNaN(new Date(value).getTime()) || new Date(value) < new Date()))) {
        setEditedMeeting(updatedMeeting)
      }
    }
  }

  const [editedMeeting, setEditedMeeting] = useState<Meeting | null>(null)

  const saveEditedMeeting = async () => {
    if (editedMeeting) {
      try {
        const res = await fetch(`/api/meetings/${editedMeeting.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedMeeting),
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to update meeting.')
        }
        await res.json()
        mutate()
        setEditedMeeting(null)
        setSuccessMessage('Changes saved successfully!')
        setTimeError('')
      } catch (err: any) {
        setTimeError(err.message)
      }
    }
  }

  useEffect(() => {
    if (editedMeeting) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      debounceTimer.current = setTimeout(() => {
        saveEditedMeeting()
      }, 5000) 
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [editedMeeting, mutate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      if (
        (isMac && e.metaKey && e.key === 's') ||
        (!isMac && e.ctrlKey && e.key === 's')
      ) {
        e.preventDefault()
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current)
        }
        saveEditedMeeting()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editedMeeting, saveEditedMeeting])

  const addNewMeeting = async () => {
    if (isAddingNewMeeting) {
      if (newMeeting.title.trim() && newMeeting.time) {
        const meetingTime = new Date(newMeeting.time)
        if (isNaN(meetingTime.getTime())) {
          setTimeError('Invalid date and time.')
          return
        }

        if (meetingTime < new Date()) {
          setTimeError('Meeting time cannot be in the past.')
          return
        }

        const meetingWithId = { ...newMeeting, time: meetingTime.toISOString() }

        const response = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meetingWithId),
        })

        if (!response.ok) {
          const errorData = await response.json()
          setTimeError(errorData.error || 'Failed to create meeting.')
          return
        }
        mutate()
        setCurrentMeetingIndex(meetings ? meetings.length : 0)
        setIsAddingNewMeeting(false)
        setNewMeeting({ title: '', time: '', link: '' })
        setTimeError('')
      } else {
        setTimeError('Please enter both title and time for the meeting.')
      }
    } else {
      setIsAddingNewMeeting(true)
      setCurrentMeetingIndex(null)
      setTimeError('')
    }
  }

  const deleteMeeting = async () => {
    if (currentMeetingIndex !== null && meetings) {
      const meetingToDelete = meetings[currentMeetingIndex]

      const response = await fetch(`/api/meetings/${meetingToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()
      alert(data.message)
      mutate()

      if (meetings.length === 1) {
        setCurrentMeetingIndex(null)
      } else if (currentMeetingIndex >= meetings.length - 1) {
        setCurrentMeetingIndex(meetings.length - 2)
      }
    }
  }

  const navigateMeeting = (direction: 'prev' | 'next') => {
    if (meetings && currentMeetingIndex !== null) {
      if (direction === 'prev' && currentMeetingIndex > 0) {
        setCurrentMeetingIndex(currentMeetingIndex - 1)
      } else if (direction === 'next' && currentMeetingIndex < meetings.length - 1) {
        setCurrentMeetingIndex(currentMeetingIndex + 1)
      }
    }
  }

  if (error) return <div className="text-white">Failed to load meetings.</div>
  if (!meetings) return <div className="text-white">Loading...</div>

  const formatToDateTimeLocal = (isoString: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return format(date, "yyyy-MM-dd'T'HH:mm")
  }

  const getMinDateTimeLocal = () => {
    const now = new Date()
    return format(now, "yyyy-MM-dd'T'HH:mm")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-black text-white">
      <h1 className="text-4xl font-bold mb-12">MEETINGS</h1>

      <div className="w-full max-w-xl">
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigateMeeting('prev')}
            disabled={currentMeetingIndex === 0 || isAddingNewMeeting || currentMeetingIndex === null}
            className="disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="text-lg">
            {isAddingNewMeeting
              ? 'New Meeting'
              : meetings.length > 0 && currentMeetingIndex !== null
              ? `${currentMeetingIndex + 1} / ${meetings.length}`
              : 'No meetings'}
          </span>
          <Button
            variant="ghost"
            onClick={() => navigateMeeting('next')}
            disabled={
              isAddingNewMeeting ||
              currentMeetingIndex === null ||
              currentMeetingIndex >= meetings.length - 1
            }
            className="disabled:opacity-50"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <div className="space-y-6">
          <input
            className="text-3xl font-semibold bg-transparent border-b-2 border-black focus:border-blue-400 w-full text-center placeholder-gray-400 text-white"
            value={isAddingNewMeeting ? newMeeting.title : localTitle}
            onChange={(e) => handleEdit('title', e.target.value)}
            placeholder={isAddingNewMeeting ? 'Enter meeting title' : 'No title'}
            disabled={!isAddingNewMeeting && currentMeeting.id === 'placeholder'}
            onFocus={(e) => e.target.select()}
          />

          <div className="relative">
            <input
              className={`text-xl text-blue-300 bg-transparent border-b-2 border-black focus:border-blue-400 w-full text-center placeholder-gray-400 ${
                !isAddingNewMeeting && currentMeeting.id === 'placeholder' ? 'cursor-not-allowed' : ''
              }`}
              value={
                isAddingNewMeeting
                  ? newMeeting.time
                    ? formatToDateTimeLocal(newMeeting.time)
                    : ''
                  : localTime
              }
              onChange={(e) => {
                handleEdit('time', e.target.value)
              }}
              type="datetime-local"
              placeholder={isAddingNewMeeting ? 'Select date and time' : 'No time set'}
              disabled={!isAddingNewMeeting && currentMeeting.id === 'placeholder'}
              min={isAddingNewMeeting ? getMinDateTimeLocal() : undefined}
              onFocus={(e) => e.target.select()}
            />
            {timeError && (
              <span className="absolute top-full left-0 mt-1 text-red-500 text-sm">
                {timeError}
              </span>
            )}
            {successMessage && (
              <span className="absolute top-full left-0 mt-1 text-green-500 text-sm">
                {successMessage}
              </span>
            )}
          </div>

          <input
            className="text-lg bg-transparent border-b-2 border-black focus:border-blue-400 w-full text-center placeholder-gray-400"
            value={isAddingNewMeeting ? newMeeting.link : localLink}
            onChange={(e) => handleEdit('link', e.target.value)}
            placeholder={isAddingNewMeeting ? 'Enter meeting link (optional)' : 'No link'}
            disabled={!isAddingNewMeeting && currentMeeting.id === 'placeholder'}
            onFocus={(e) => e.target.select()}
          />
        </div>

        <div className="mt-12 flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-4">
          <Button onClick={addNewMeeting} variant="primary" className="w-full">
            {isAddingNewMeeting ? 'Save Meeting' : 'New Meeting'}
          </Button>

          {!isAddingNewMeeting && meetings.length > 0 && currentMeetingIndex !== null && (
            <Button variant="destructive" onClick={deleteMeeting} className="w-full">
              Delete
            </Button>
          )}
        </div>

        {!isAddingNewMeeting && currentMeeting.link && currentMeeting.link.trim() !== '' && (
          <div className="mt-8 text-center">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => window.open(currentMeeting.link, '_blank')}
            >
              Join Meeting
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/'
}

function getCookie(name: string) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=')
    return parts[0] === name ? decodeURIComponent(parts[1]) : r
  }, '')
}
