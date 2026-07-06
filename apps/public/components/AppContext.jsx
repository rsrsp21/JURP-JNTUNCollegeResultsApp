'use client';

import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppContextProvider({ children }) {
  // ask-ai Chat State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your Results AI assistant. I can help you with CGPA and SGPA queries, semester performance, backlogs, topper lists, and portal navigation. What would you like to know?"
    }
  ]);
  const [askAiInput, setAskAiInput] = useState('');
  const [activeStudentId, setActiveStudentId] = useState('');

  // Semester Results State
  const [resultsRollNumber, setResultsRollNumber] = useState('');
  const [resultsPayload, setResultsPayload] = useState(null);
  const [resultsOpenSemesters, setResultsOpenSemesters] = useState({});

  // CGPA State
  const [cgpaRollNumber, setCgpaRollNumber] = useState('');
  const [cgpaStudent, setCgpaStudent] = useState(null);

  return (
    <AppContext.Provider
      value={{
        messages,
        setMessages,
        askAiInput,
        setAskAiInput,
        activeStudentId,
        setActiveStudentId,
        resultsRollNumber,
        setResultsRollNumber,
        resultsPayload,
        setResultsPayload,
        resultsOpenSemesters,
        setResultsOpenSemesters,
        cgpaRollNumber,
        setCgpaRollNumber,
        cgpaStudent,
        setCgpaStudent
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
}
