import React, { useState, useEffect, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, isSameDay, parseISO } from 'date-fns'
import Button from '@/app/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
// @ts-ignore
import { saveAs } from 'file-saver'

interface Meeting {
  id: string
  title: string
  time: string
  link: string
  deleteVotes: number
}

interface CalendarProps {
  meetings: Meeting[]
  currentMonth: Date
  onChangeMonth: (amount: number) => void
  onSelectMeeting: (meetingId: string) => void
  onExportICS?: () => void
}

const MeetingTooltip: React.FC<{
  meeting: Meeting
  isVisible: boolean
  onClick: () => void
  onClose: () => void
  position: { x: number; y: number }
  isMobile?: boolean
}> = ({ meeting, isVisible, onClick, onClose, position, isMobile = false }) => {
  if (!isVisible) return null;

  const mobileStyles = isMobile ? {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '90vw',
    minWidth: '280px',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  } : {
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -100%)',
    maxWidth: '280px',
    minWidth: '200px',
  };

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <>
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black bg-opacity-50"
              onClick={onClose}
            />
          )}
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-[9999] bg-gray-900 border-2 border-blue-400 rounded-lg p-4 shadow-2xl ${
              isMobile ? 'text-base' : 'text-sm'
            }`}
            style={{
              ...mobileStyles,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white">
              {isMobile && (
                <button 
                  className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl leading-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  ×
                </button>
              )}
              
              <h3 className={`font-bold mb-3 text-blue-300 ${isMobile ? 'text-lg pr-8' : 'text-sm'}`}>
                {meeting.title}
              </h3>
              <p className={`text-gray-300 mb-3 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                {format(parseISO(meeting.time), 'MMM d, yyyy • h:mm a')}
              </p>
              {meeting.link && (
                <p className={`text-blue-400 mb-4 break-all ${isMobile ? 'text-sm' : 'text-xs'}`} title={meeting.link}>
                  🔗 {meeting.link}
                </p>
              )}
              <Button 
                variant="primary"
                className={`w-full ${isMobile ? 'py-3 text-sm' : 'py-2 text-xs'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
              >
                View Details
              </Button>
            </div>
            
            {!isMobile && (
              <div 
                className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-400"
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

const Calendar: React.FC<CalendarProps> = ({ 
  meetings, 
  currentMonth, 
  onChangeMonth, 
  onSelectMeeting,
}) => {
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [multiTooltipOpen, setMultiTooltipOpen] = useState(false);
  const multiTooltipTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseEnter = (meetingId: string, event: React.MouseEvent) => {
    if (isMobile) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setActiveMeeting(meetingId);
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setActiveMeeting(null);
    }
  };

  const handleTouchStart = (meetingId: string, event: React.TouchEvent) => {
    if (!isMobile) return;
    
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setActiveMeeting(meetingId);
  };

  const handleCloseTooltip = () => {
    setActiveMeeting(null);
  };
  
  const containerStyle = {
    position: 'relative' as const,
    zIndex: 1
  };
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.calendar-event')) {
        return;
      }
      setActiveMeeting(null);
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.calendar-event')) {
        return;
      }
      setTimeout(() => {
        setActiveMeeting(null);
      }, 300);
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
  
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  const startDay = getDay(monthStart)
  const prependDays = Array.from({ length: startDay }, (_, i) => 
    addDays(monthStart, -(startDay - i))
  )
  
  const gridSize = Math.ceil((monthDays.length + startDay) / 7) * 7
  const appendDays = Array.from(
    { length: gridSize - (monthDays.length + startDay) }, 
    (_, i) => addDays(monthEnd, i + 1)
  )
  
  const calendarDays = [...prependDays, ...monthDays, ...appendDays]
  
  const meetingsByDay: Record<string, Meeting[]> = {}
  meetings.forEach(meeting => {
    const meetingDate = parseISO(meeting.time)
    const dateKey = format(meetingDate, 'yyyy-MM-dd')
    
    if (!meetingsByDay[dateKey]) {
      meetingsByDay[dateKey] = []
    }
    
    meetingsByDay[dateKey].push(meeting)
  })

//   const downloadICS = () => {
//     const pad = (n: number) => n.toString().padStart(2, '0');
//     const formatICSDate = (date: Date) => {
//       return date.getUTCFullYear() +
//         pad(date.getUTCMonth() + 1) +
//         pad(date.getUTCDate()) + 'T' +
//         pad(date.getUTCHours()) +
//         pad(date.getUTCMinutes()) +
//         pad(date.getUTCSeconds()) + 'Z';
//     };
//     let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n';
//     meetings.forEach(meeting => {
//       const start = new Date(meeting.time);
//       const end = new Date(start.getTime() + 60 * 60 * 1000);
//       ics += 'BEGIN:VEVENT\n';
//       ics += `SUMMARY:${meeting.title}\n`;
//       ics += `DTSTART:${formatICSDate(start)}\n`;
//       ics += `DTEND:${formatICSDate(end)}\n`;
//       ics += `DESCRIPTION:${meeting.link || ''}\n`;
//       ics += `UID:${meeting.id}@meeting-dashboard\n`;
//       ics += 'END:VEVENT\n';
//     });
//     ics += 'END:VCALENDAR';
//     const blob = new Blob([ics], { type: 'text/calendar' });
//     saveAs(blob, 'meetings.ics');
//   };

  const handleMultiMouseEnter = () => {
    if (multiTooltipTimer.current) clearTimeout(multiTooltipTimer.current);
    setMultiTooltipOpen(true);
    setActiveMeeting('multiple');
  };
  const handleMultiMouseLeave = () => {
    if (multiTooltipTimer.current) clearTimeout(multiTooltipTimer.current);
    multiTooltipTimer.current = setTimeout(() => {
      setMultiTooltipOpen(false);
      setActiveMeeting(null);
    }, 180);
  };

  return (
    <div className={`w-full max-w-4xl flex flex-col ${
      isMobile ? 'h-[calc(100vh-100px)] px-2' : 'h-[calc(100vh-240px)]'
    } max-h-screen`} style={containerStyle}>
      <div className={`flex justify-between items-center ${isMobile ? 'mb-2' : 'mb-1'}`}>
        <Button 
          variant="ghost" 
          onClick={() => onChangeMonth(-1)} 
          className={`${isMobile ? 'py-2 px-3 h-10 text-sm' : 'py-1 px-2 h-8'}`}
        >
          ← {isMobile ? '' : 'Prev'}
        </Button>
        <h2 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg sm:text-xl'}`}>
          {format(currentMonth, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
        </h2>
        <Button 
          variant="ghost" 
          onClick={() => onChangeMonth(1)} 
          className={`${isMobile ? 'py-2 px-3 h-10 text-sm' : 'py-1 px-2 h-8'}`}
        >
          {isMobile ? '' : 'Next'} →
        </Button>
      </div>
      
      <div className={`grid grid-cols-7 ${isMobile ? 'gap-0.5 mb-1' : 'gap-1 mb-1'}`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={`text-center py-1 text-gray-400 ${
            isMobile ? 'text-[10px] font-medium' : 'text-xs sm:text-sm'
          }`}>
            {isMobile ? day.slice(0, 1) : day}
          </div>
        ))}
      </div>

      <div 
        className={`grid grid-cols-7 flex-grow overflow-visible ${
          isMobile ? 'gap-0.5' : 'gap-1'
        }`}
        style={{ 
          gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(${
            isMobile ? '50px' : '80px'
          }, 1fr))` 
        }}
      >
        {calendarDays.map((day, i) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayMeetings = meetingsByDay[dateKey] || []
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const isToday = isSameDay(day, new Date())
          
          return (
            <div 
              key={i} 
              className={`relative h-full border border-gray-800 rounded-md ${
                isMobile ? 'p-0.5' : 'p-1'
              } calendar-grid-cell ${
                isCurrentMonth ? 'bg-black' : 'bg-gray-900 opacity-50'
              } ${isToday ? 'border-blue-500' : ''}`}
            >
              <div className={`text-right ${
                isMobile ? 'text-[9px] mb-0.5' : 'text-xs mb-1'
              } ${
                isToday ? 'text-blue-400 font-bold' : isCurrentMonth ? 'text-white' : 'text-gray-500'
              }`}>
                {format(day, 'd')}
              </div>
              
              <div className={`${isMobile ? 'h-[calc(100%-14px)]' : 'h-[calc(100%-20px)]'} relative`}>
                {dayMeetings.length > 0 && (
                  dayMeetings.length <= (isMobile ? 1 : 3) ? (
                    dayMeetings.slice(0, isMobile ? 1 : 3).map(meeting => (
                      <div key={meeting.id} className="relative">
                        <div
                          className={`${
                            isMobile 
                              ? 'text-[9px] p-0.5 mb-0.5'
                              : 'text-[9px] sm:text-xs p-1 mb-1'
                          } bg-blue-900 rounded cursor-pointer hover:bg-blue-800 truncate calendar-event relative`}
                          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                            e.stopPropagation();
                            if (isMobile) {
                              if (activeMeeting !== meeting.id) {
                                const currentTarget = e.currentTarget;
                                const rect = currentTarget.getBoundingClientRect();
                                setTooltipPosition({
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 10,
                                });
                                setActiveMeeting(meeting.id);
                              } else {
                                onSelectMeeting(meeting.id);
                              }
                            } else {
                              if (activeMeeting !== meeting.id) {
                                onSelectMeeting(meeting.id);
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            handleMouseEnter(meeting.id, e);
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            handleMouseLeave();
                          }}
                          onTouchStart={(e: React.TouchEvent<HTMLDivElement>) => { 
                            e.stopPropagation();
                            handleTouchStart(meeting.id, e);
                          }}
                        >
                          <span className="inline-block w-full truncate">
                            {isMobile ? (
                              `${format(parseISO(meeting.time), 'HH:mm')} ${meeting.title.substring(0, 6)}${meeting.title.length > 6 ? '...' : ''}` 
                            ) : (
                              `${format(parseISO(meeting.time), 'HH:mm')} ${meeting.title.length > 10 ? meeting.title.substring(0, 10) + '...' : meeting.title}`
                            )}
                          </span>
                          
                          {activeMeeting === meeting.id && (
                            <MeetingTooltip 
                              meeting={meeting} 
                              isVisible={true}
                              onClick={() => onSelectMeeting(meeting.id)} 
                              onClose={handleCloseTooltip}
                              position={tooltipPosition}
                              isMobile={isMobile}
                            />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="relative">
                      <div 
                        className={`${
                          isMobile 
                            ? 'text-[8px] p-0.5' 
                            : 'text-[9px] sm:text-xs p-1'
                        } bg-blue-900 rounded cursor-pointer hover:bg-blue-800 text-center calendar-event relative`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMeeting(activeMeeting === 'multiple' ? null : 'multiple');
                          setMultiTooltipOpen(true);
                        }}
                        onMouseEnter={handleMultiMouseEnter}
                        onMouseLeave={handleMultiMouseLeave}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          setActiveMeeting('multiple');
                          setMultiTooltipOpen(true);
                        }}
                      >
                        <span className="inline-block">
                          {dayMeetings.length} {isMobile ? 'mtgs' : 'meetings'}
                        </span>
                      </div>

                      {activeMeeting === 'multiple' && (
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`absolute z-[9999] bg-gray-800 border-2 border-blue-500 rounded-md ${
                              isMobile ? 'p-1.5' : 'p-3'
                            } shadow-xl`}
                            style={{ 
                              bottom: i < 14 ? 'auto' : '110%', 
                              top: i < 14 ? '110%' : 'auto',
                              left: '50%', 
                              transform: 'translateX(-50%)', 
                              minWidth: isMobile ? '150px' : '200px',
                              maxWidth: '85vw',
                              boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={handleMultiMouseEnter}
                            onMouseLeave={handleMultiMouseLeave}
                          >
                            <h3 className={`font-semibold mb-1.5 ${isMobile ? 'text-[11px]' : 'text-sm'}`}>
                              {format(day, isMobile ? 'MMM d' : 'MMMM d, yyyy')}
                            </h3>
                            <div className={`overflow-y-auto ${isMobile ? 'max-h-[100px]' : 'max-h-[150px]'} custom-scrollbar`}>
                              {dayMeetings.map(meeting => (
                                <div 
                                  key={meeting.id} 
                                  className={`${
                                    isMobile ? 'text-[9px] p-1 mb-0.5' : 'text-xs p-2 mb-1'
                                  } bg-blue-900 rounded cursor-pointer hover:bg-blue-800`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectMeeting(meeting.id);
                                  }}
                                >
                                  <p className="font-semibold truncate">{meeting.title}</p>
                                  <p className={`text-gray-300 ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
                                    {format(parseISO(meeting.time), 'h:mm a')}
                                  </p>
                                </div>
                              ))}
                            </div>
                            
                            {/* Close button */}
                            <button 
                              className={`absolute ${isMobile ? 'top-0 right-0 p-0.5' : 'top-1 right-1'} text-gray-400 hover:text-white ${
                                isMobile ? 'text-xs' : 'text-base'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMeeting(null);
                              }}
                            >
                              ✕
                            </button>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/*
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  background: #222;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3a86ff;
  border-radius: 6px;
}
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #3a86ff #222;
}
*/

export default Calendar
