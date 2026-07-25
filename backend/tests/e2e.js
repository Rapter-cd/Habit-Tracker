const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 Starting StreakUp End-to-End API Tests...\n');
  let passed = 0;
  let failed = 0;
  let token = '';
  let habitId = '';
  let groupId = '';
  
  const testEmail = `test_${Date.now()}@streakup.dev`;
  const testPassword = 'password123';

  const logResult = (name, success, error = null) => {
    if (success) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name}`);
      if (error) console.log(`   └─ Error: ${error}`);
      failed++;
    }
  };

  try {
    // 1. Auth: Register
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: testEmail, password: testPassword })
    });
    const regData = await regRes.json();
    logResult('Auth: Register new user', regRes.ok && !!regData.token, JSON.stringify(regData));
    token = regData.token;

    // 2. Auth: Get current user profile
    const profileRes = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    logResult('Auth: Fetch user profile (/auth/me)', profileRes.ok && profileData.email === testEmail, JSON.stringify(profileData));

    // 3. Habits: Create a habit
    const createHabitRes = await fetch(`${API_URL}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Testing Habit', category: 'Work', frequency: 'daily' })
    });
    const habitData = await createHabitRes.json();
    habitId = habitData._id;
    logResult('Habits: Create new daily habit', createHabitRes.ok && !!habitId, JSON.stringify(habitData));

    // 4. Habits: List habits
    const listHabitsRes = await fetch(`${API_URL}/habits`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listHabitsRes.json();
    logResult('Habits: Retrieve habit list', listHabitsRes.ok && Array.isArray(listData) && listData.length > 0);

    // 5. Checkins: Complete a checkin for today
    const checkinRes = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'done', date: new Date().toISOString() })
    });
    const checkinData = await checkinRes.json();
    logResult('Checkins: Complete daily checkin', checkinRes.ok && checkinData.habit && checkinData.habit.currentStreak === 1, JSON.stringify(checkinData));

    // 6. Checkins: Idempotent duplicate checkin (updates instead of throwing 400)
    const doubleCheckinRes = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'done', date: new Date().toISOString() })
    });
    logResult('Checkins: Idempotent duplicate daily checkin', doubleCheckinRes.ok && doubleCheckinRes.status === 201);

    // 7. Groups: Create social group
    const createGroupRes = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Testers Group', description: 'Testing the APIs' })
    });
    const groupData = await createGroupRes.json();
    groupId = groupData._id;
    logResult('Groups: Create new social group', createGroupRes.ok && !!groupId && !!groupData.inviteCode, JSON.stringify(groupData));

    // 8. Analytics: Fetch heatmap data
    const analyticsRes = await fetch(`${API_URL}/analytics/heatmap/${habitId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const analyticsData = await analyticsRes.json();
    logResult('Analytics: Fetch heatmap data', analyticsRes.ok && Array.isArray(analyticsData), JSON.stringify(analyticsData));

    // 9. Habits: Delete habit
    const deleteHabitRes = await fetch(`${API_URL}/habits/${habitId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    logResult('Habits: Delete habit safely', deleteHabitRes.ok);

  } catch (err) {
    console.error('Fatal Test Error:', err);
  }

  console.log('\n--- Test Summary ---');
  console.log(`Total:  ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
