import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
export interface TestSettings {
  testStartTime: Date;
  testDuration: number; // in minutes
  maxTabSwitches: number;
  isTestActive: boolean;
}
export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}
export interface TestAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}
export interface TestResult {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  admissionNumber: string;
  branch: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number; // in seconds
  answers: TestAnswer[];
  completedAt: Date;
  status: 'completed' | 'in-progress' | 'abandoned';
}
export interface UserTestStatus {
  userId: string;
  hasSubmitted: boolean;
  submissionDate?: Date;
  tabSwitchCount: number;
  isTestCancelled: boolean;
  lastActivity: Date;
}
export const testService = {
  getTestSettings: (): TestSettings => ({
    testStartTime: new Date('2025-08-29T15:00:00'), // Fixed start time for all users
    testDuration: 60, // 60 minutes
    maxTabSwitches: 5,
    isTestActive: true
  }),
  isTestAvailable: (): boolean => {
    const settings = testService.getTestSettings();
    return new Date() >= settings.testStartTime;
  },
  getTestEndTime: (): Date => {
    const settings = testService.getTestSettings();
    return new Date(settings.testStartTime.getTime() + settings.testDuration * 60 * 1000);
  },
  async getUserTestStatus(userId: string): Promise<UserTestStatus | null> {
    try {
      // First try to create the document if it doesn't exist
      const statusRef = doc(db, 'userTestStatus', userId);
      
      try {
        const statusDoc = await getDoc(statusRef);
        
        if (statusDoc.exists()) {
          const data = statusDoc.data();
          return {
            userId,
            hasSubmitted: data.hasSubmitted || false,
            submissionDate: data.submissionDate?.toDate(),
            tabSwitchCount: data.tabSwitchCount || 0,
            isTestCancelled: data.isTestCancelled || false,
            lastActivity: data.lastActivity?.toDate() || new Date()
          };
        } else {
          // Document doesn't exist, create it with default values
          const defaultStatus = {
            userId,
            hasSubmitted: false,
            tabSwitchCount: 0,
            isTestCancelled: false,
            lastActivity: new Date()
          };
          
          await setDoc(statusRef, defaultStatus);
          return defaultStatus;
        }
      } catch (docError: any) {
        // If we can't read the document, try to create it
        if (docError.code === 'permission-denied' || docError.code === 'not-found') {
          const defaultStatus = {
            userId,
            hasSubmitted: false,
            tabSwitchCount: 0,
            isTestCancelled: false,
            lastActivity: new Date()
          };
          
          await setDoc(doc(db, 'userTestStatus', userId), defaultStatus);
          return defaultStatus;
        }
        throw docError;
      }
      
    } catch (error: any) {
      console.error('Error in getUserTestStatus:', error);
      throw new Error(`Failed to get user test status: ${error.message}`);
    }
  },
  async updateUserTestStatus(userId: string, status: Partial<UserTestStatus>): Promise<void> {
    try {
      const statusRef = doc(db, 'userTestStatus', userId);
      await updateDoc(statusRef, {
        ...status,
        lastActivity: new Date()
      });
    } catch (error: any) {
      // If document doesn't exist, create it
      if (error.code === 'not-found') {
        await setDoc(doc(db, 'userTestStatus', userId), {
          userId,
          hasSubmitted: false,
          tabSwitchCount: 0,
          isTestCancelled: false,
          lastActivity: new Date(),
          ...status
        });
      } else {
        throw new Error(error.message || 'Failed to update user test status');
      }
    }
  },
  async markTestAsSubmitted(userId: string): Promise<void> {
    try {
      const statusRef = doc(db, 'userTestStatus', userId);
      const statusDoc = await getDoc(statusRef);
      
      if (statusDoc.exists()) {
        await updateDoc(statusRef, {
          hasSubmitted: true,
          submissionDate: new Date(),
          lastActivity: new Date()
        });
      } else {
        await setDoc(doc(db, 'userTestStatus', userId), {
          userId,
          hasSubmitted: true,
          submissionDate: new Date(),
          tabSwitchCount: 0,
          isTestCancelled: false,
          lastActivity: new Date()
        });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to mark test as submitted');
    }
  },
  async incrementTabSwitchCount(userId: string): Promise<number> {
    try {
      const statusRef = doc(db, 'userTestStatus', userId);
      const statusDoc = await getDoc(statusRef);
      
      let newCount = 1;
      
      if (statusDoc.exists()) {
        const currentCount = statusDoc.data().tabSwitchCount || 0;
        newCount = currentCount + 1;
        
        await updateDoc(statusRef, {
          tabSwitchCount: newCount,
          lastActivity: new Date()
        });
      } else {
        await setDoc(doc(db, 'userTestStatus', userId), {
          userId,
          hasSubmitted: false,
          tabSwitchCount: newCount,
          isTestCancelled: false,
          lastActivity: new Date()
        });
      }
      
      return newCount;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to increment tab switch count');
    }
  },
  async cancelTest(userId: string): Promise<void> {
    try {
      const statusRef = doc(db, 'userTestStatus', userId);
      const statusDoc = await getDoc(statusRef);
      
      if (statusDoc.exists()) {
        await updateDoc(statusRef, {
          isTestCancelled: true,
          lastActivity: new Date()
        });
      } else {
        await setDoc(doc(db, 'userTestStatus', userId), {
          userId,
          hasSubmitted: false,
          tabSwitchCount: 0,
          isTestCancelled: true,
          lastActivity: new Date()
        });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to cancel test');
    }
  },
  // Sample test questions
  getTestQuestions: (): TestQuestion[] => [
    {
      id: '1',
      question: 'In computer networks, what does IP stand for?',
      options: [
        'Internet Protocol',
        'Internal Processing',
        'Interface Program',
        'Information Packet'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '2',
      question: 'Which programming paradigm focuses on objects and classes?',
      options: [
        'Functional Programming',
        'Procedural Programming',
        'Object-Oriented Programming',
        'Logic Programming'
      ],
      correctAnswer: 2,
      category: 'Technical'
    },
    {
      id: '3',
      question: 'What does HTML stand for?',
      options: [
        'Hyper Text Markup Language',
        'High Tech Modern Language',
        'Home Tool Markup Language',
        'Hyperlink and Text Markup Language'
      ],
      correctAnswer: 0,
      category: 'Technical'
    },
    {
      id: '4',
      question: 'Which of the following is a version control system?',
      options: [
        'MySQL',
        'Git',
        'Apache',
        'Node.js'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '5',
      question: 'What is the time complexity of binary search?',
      options: [
        'O(n)',
        'O(log n)',
        'O(n²)',
        'O(1)'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '6',
      question: 'Which HTTP method is used to retrieve data?',
      options: [
        'POST',
        'PUT',
        'GET',
        'DELETE'
      ],
      correctAnswer: 2,
      category: 'Technical'
    },
    {
      id: '7',
      question: 'What does CSS stand for?',
      options: [
        'Computer Style Sheets',
        'Cascading Style Sheets',
        'Creative Style Sheets',
        'Colorful Style Sheets'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '8',
      question: 'Which data structure follows LIFO principle?',
      options: [
        'Queue',
        'Array',
        'Stack',
        'Linked List'
      ],
      correctAnswer: 2,
      category: 'Technical'
    },
    {
      id: '9',
      question: 'What is the purpose of a database index?',
      options: [
        'To store data',
        'To improve query performance',
        'To backup data',
        'To encrypt data'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '10',
      question: 'Which of the following is NOT a JavaScript framework?',
      options: [
        'React',
        'Angular',
        'Vue.js',
        'Laravel'
      ],
      correctAnswer: 3,
      category: 'Technical'
    },
    {
      id: '12',
      question: 'What is the output of: (Python Code Snippet) print(2 ** 3 ** 2)',
      options: [
        '64',
        '512',
        '256',
        '8'
      ],
      correctAnswer: 2,
      category: 'Technical'
    },
    {
      id: '13',
      question: 'Which of the following do not touch their hair in EB reel',
      options: [
        'Abhinivesh Sharma',
        'Lakshita Gupta',
        'Bhavya',
        'Haryiank Kumra'
      ],
      correctAnswer: 1,
      category: 'Technical'
    },
    {
      id: '14',
      question: 'Which of the following is a joint secretary of ISTE?',
      options: [
        'Lakshita Gupta',
        'Hariyank Kumra',
        'Ishaan Sharma',
        'Abhinivesh Sharma'
      ],
      correctAnswer: 4,
      category: 'General'
    },
    {
      id: '15',
      question: 'Which of the following is a Core Member?',
      options: [
        'Rudraksh',
        'Navjot',
        'Happy',
        'Yuvraj'
      ],
      correctAnswer: 4,
      category: 'General'
    },
  ],
  async submitTestResult(testResult: Omit<TestResult, 'id'>): Promise<string> {
    try {
      // Mark test as submitted
      await this.markTestAsSubmitted(testResult.userId);
      
      const docRef = await addDoc(collection(db, 'testResults'), {
        ...testResult,
        completedAt: new Date()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit test result');
    }
  },
  async getUserTestResults(userId: string): Promise<TestResult[]> {
    try {
      const q = query(
        collection(db, 'testResults'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const results: TestResult[] = [];
      
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        } as TestResult);
      });
      
      // Sort results by completedAt in descending order on client side
      return results.sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt : a.completedAt.toDate();
        const dateB = b.completedAt instanceof Date ? b.completedAt : b.completedAt.toDate();
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get test results');
    }
  },
  async getAllTestResults(): Promise<TestResult[]> {
    try {
      const q = query(
        collection(db, 'testResults'),
        orderBy('completedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const results: TestResult[] = [];
      
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        } as TestResult);
      });
      
      return results;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get all test results');
    }
  },
  calculateScore(answers: TestAnswer[]): { score: number; percentage: number } {
    const correctAnswers = answers.filter(answer => answer.isCorrect).length;
    const totalQuestions = answers.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    return {
      score: correctAnswers,
      percentage
    };
  },
  getGradeFromPercentage(percentage: number): { grade: string; color: string; message: string } {
    if (percentage >= 90) {
      return {
        grade: 'A+',
        color: 'text-green-400',
        message: 'Outstanding Performance!'
      };
    } else if (percentage >= 80) {
      return {
        grade: 'A',
        color: 'text-green-400',
        message: 'Excellent Work!'
      };
    } else if (percentage >= 70) {
      return {
        grade: 'B+',
        color: 'text-blue-400',
        message: 'Good Performance!'
      };
    } else if (percentage >= 60) {
      return {
        grade: 'B',
        color: 'text-blue-400',
        message: 'Satisfactory!'
      };
    } else if (percentage >= 50) {
      return {
        grade: 'C',
        color: 'text-yellow-400',
        message: 'Needs Improvement!'
      };
    } else {
      return {
        grade: 'F',
        color: 'text-red-400',
        message: 'Better Luck Next Time!'
      };
    }
  }
};
