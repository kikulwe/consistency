// The 12-week beginner program and the exercise library (how-to, common mistakes, alternatives).
// To change the program, edit WORKOUTS / PHASES here; the Gym module reads everything from this file.

export const PHASES = [
  { n: 1, name: 'Learn', from: 1, to: 4, focus: 'Form with light weights and machines', sets: 2, reps: 12 },
  { n: 2, name: 'Build', from: 5, to: 8, focus: 'Add weight steadily', sets: 3, reps: 10 },
  { n: 3, name: 'Strength', from: 9, to: 12, focus: 'Heavier, fewer reps', sets: 3, reps: 8 },
];
export const WEEKS = 12, PER_WEEK = 3, TOTAL = WEEKS * PER_WEEK, REST_SECONDS = 90;
export const phaseOf = week => PHASES.find(p => week >= p.from && week <= p.to) || PHASES[PHASES.length - 1];

export const WORKOUTS = {
  A: ['goblet_squat', 'chest_press', 'cable_row', 'rdl', 'plank', 'incline_walk'],
  B: ['leg_press', 'lat_pulldown', 'db_shoulder_press', 'db_lunge', 'dead_bug', 'bike'],
};

export const EQUIPMENT = [
  ['dumbbells', 'Dumbbells'], ['bench', 'Bench'], ['leg_press', 'Leg press machine'], ['chest_press', 'Chest press machine'],
  ['cable_row', 'Seated cable row'], ['lat_pulldown', 'Lat pulldown'], ['shoulder_machine', 'Shoulder press machine'],
  ['treadmill', 'Treadmill'], ['bike', 'Exercise bike'],
];

// kind: 'weight' (sets x reps at a weight), 'hold' (sets x seconds), 'reps' (sets x reps, no weight), 'cardio' (minutes)
// start = starting weight in kg (or seconds / reps), step = what "the next weight up" means
export const EX = {
  goblet_squat: { name: 'Goblet squat', muscles: 'Legs and glutes', kind: 'weight', needs: ['dumbbells'], start: 6, step: 2, load: 'one dumbbell', demo: 'squat', alts: ['bw_squat', 'leg_press'],
    how: ['Hold one dumbbell upright against your chest with both hands, elbows tucked.', 'Stand with feet a little wider than your shoulders, toes turned slightly out.', 'Sit down and back as if into a low chair, until your thighs are about level with the floor.', 'Push through your whole foot to stand back up.'],
    mistakes: ['Heels lifting off the floor. Keep your weight over mid-foot.', 'Knees caving inwards. Push them out in line with your toes.', 'Chest dropping forward. Keep the dumbbell touching your chest.'] },
  chest_press: { name: 'Machine chest press', muscles: 'Chest, shoulders, triceps', kind: 'weight', needs: ['chest_press'], start: 15, step: 5, load: 'on the stack', demo: 'chestpress', alts: ['db_bench_press', 'push_up'],
    how: ['Set the seat so the handles line up with the middle of your chest.', 'Sit with your back flat against the pad and feet planted.', 'Push the handles forward until your arms are almost straight.', 'Bring them back slowly until your hands are level with your chest.'],
    mistakes: ['Seat too low, so the handles are at shoulder height.', 'Locking the elbows hard at the end.', 'Letting the weight stack crash down between reps.'] },
  cable_row: { name: 'Seated cable row', muscles: 'Back and biceps', kind: 'weight', needs: ['cable_row'], start: 20, step: 5, load: 'on the stack', demo: 'row', alts: ['db_row'],
    how: ['Sit with feet on the plates and knees slightly bent.', 'Take the handle and sit tall with arms straight.', 'Pull the handle to your belly button, elbows brushing your sides.', 'Squeeze your shoulder blades together, then let your arms go straight again slowly.'],
    mistakes: ['Rocking the body back and forth to move the weight.', 'Shrugging the shoulders up to the ears.', 'Rounding the lower back on the way forward.'] },
  rdl: { name: 'Romanian deadlift (dumbbells)', muscles: 'Hamstrings, glutes, lower back', kind: 'weight', needs: ['dumbbells'], start: 6, step: 2, load: 'each dumbbell', demo: 'rdl', alts: ['glute_bridge'],
    how: ['Stand tall with a dumbbell in each hand in front of your thighs.', 'Soften your knees and keep them that way.', 'Push your hips straight back and slide the dumbbells down your legs, back flat.', 'Stop around mid-shin, when you feel a stretch in your hamstrings, then squeeze your glutes to stand.'],
    mistakes: ['Rounding the back. Go only as low as you can stay flat.', 'Turning it into a squat by bending the knees more.', 'Letting the dumbbells drift away from your legs.'] },
  plank: { name: 'Plank', muscles: 'Core', kind: 'hold', needs: [], start: 20, step: 5, demo: 'plank', alts: ['knee_plank'],
    how: ['Rest on your forearms with elbows under your shoulders.', 'Step your feet back so your body is one straight line.', 'Squeeze your glutes and brace your stomach as if about to be poked.', 'Breathe normally and hold for the time shown.'],
    mistakes: ['Hips sagging towards the floor.', 'Hips piked up high.', 'Holding your breath.'] },
  incline_walk: { name: 'Incline walk', muscles: 'Heart and legs', kind: 'cardio', needs: ['treadmill'], start: 10, demo: 'walk', alts: ['bike'],
    how: ['Set the treadmill to a 5 to 8% incline.', 'Walk at a pace where you can still talk in short sentences.', 'Swing your arms naturally and keep your hands off the rails.'],
    mistakes: ['Holding the rails and leaning back, which takes the work away.', 'Starting too fast. Build up over the first minute.'] },
  leg_press: { name: 'Leg press', muscles: 'Legs and glutes', kind: 'weight', needs: ['leg_press'], start: 40, step: 10, load: 'on the machine', demo: 'legpress', alts: ['goblet_squat', 'bw_squat'],
    how: ['Sit with your back and hips flat against the pad.', 'Place your feet shoulder-width apart in the middle of the plate.', 'Push the plate away until your legs are almost straight, then release the safety handles.', 'Lower slowly until your knees are at about 90 degrees, then push back up.'],
    mistakes: ['Locking the knees out at the top.', 'Letting your hips roll up off the pad at the bottom.', 'Going too heavy with tiny half reps.'] },
  lat_pulldown: { name: 'Lat pulldown', muscles: 'Back and biceps', kind: 'weight', needs: ['lat_pulldown'], start: 20, step: 5, load: 'on the stack', demo: 'pulldown', alts: ['db_row'],
    how: ['Adjust the thigh pad so your legs are held snugly.', 'Hold the bar a little wider than your shoulders, palms facing away.', 'Lean back slightly and pull the bar down to your upper chest, leading with your elbows.', 'Let it rise slowly until your arms are straight.'],
    mistakes: ['Pulling the bar behind your neck.', 'Swinging your whole body backwards.', 'Stopping the bar at chin height.'] },
  db_shoulder_press: { name: 'Dumbbell shoulder press', muscles: 'Shoulders and triceps', kind: 'weight', needs: ['dumbbells'], start: 4, step: 2, load: 'each dumbbell', demo: 'press', alts: ['machine_shoulder_press'],
    how: ['Sit or stand tall with a dumbbell in each hand at shoulder height, palms forward.', 'Brace your stomach so your back does not arch.', 'Press both dumbbells straight up until your arms are almost straight.', 'Lower them slowly back to shoulder height.'],
    mistakes: ['Arching the lower back to push the weight up.', 'Letting the elbows flare straight out to the sides. Keep them slightly forward.', 'Using your legs to bounce the weight.'] },
  db_lunge: { name: 'Dumbbell lunges', muscles: 'Legs, glutes, balance', kind: 'weight', needs: ['dumbbells'], start: 0, step: 2, load: 'each dumbbell', perSide: true, demo: 'lunge', alts: ['split_squat', 'bw_squat'],
    how: ['Stand tall, dumbbells by your sides (start with none until your balance is steady).', 'Take a long step forward with one leg.', 'Lower straight down until your back knee is just above the floor.', 'Push through the front foot to step back. Do all reps on one leg, then the other.'],
    mistakes: ['Step too short, so the front knee shoots far past the toes.', 'Leaning the chest forward.', 'Feet in one line like a tightrope. Keep them hip-width apart.'] },
  dead_bug: { name: 'Dead bug', muscles: 'Core', kind: 'reps', needs: [], start: 6, step: 2, perSide: true, demo: 'deadbug', alts: ['bird_dog'],
    how: ['Lie on your back with arms straight up and knees bent at 90 degrees above your hips.', 'Press your lower back gently into the floor.', 'Slowly lower your right arm and left leg towards the floor.', 'Return, then switch sides. That is one rep each side.'],
    mistakes: ['Lower back arching off the floor.', 'Rushing. Slower is harder and better.', 'Holding your breath.'] },
  bike: { name: 'Bike', muscles: 'Heart and legs', kind: 'cardio', needs: ['bike'], start: 10, demo: 'bike', alts: ['incline_walk'],
    how: ['Set the seat so your knee is slightly bent at the bottom of each pedal stroke.', 'Pedal at a steady pace where you can still talk in short sentences.', 'Keep your shoulders relaxed.'],
    mistakes: ['Seat too low, which strains the knees.', 'Resistance so high that you have to rock side to side.'] },

  /* alternatives, used when a machine is busy or your gym does not have it */
  bw_squat: { name: 'Bodyweight squat', muscles: 'Legs and glutes', kind: 'reps', needs: [], start: 12, step: 2, demo: 'bwsquat', alts: ['goblet_squat'],
    how: ['Stand with feet a little wider than your shoulders.', 'Reach your arms forward for balance.', 'Sit down and back until your thighs are level with the floor.', 'Stand back up by pushing through your whole foot.'],
    mistakes: ['Heels lifting.', 'Knees caving inwards.'] },
  db_bench_press: { name: 'Dumbbell bench press', muscles: 'Chest, shoulders, triceps', kind: 'weight', needs: ['dumbbells', 'bench'], start: 6, step: 2, load: 'each dumbbell', demo: 'bench', alts: ['push_up'],
    how: ['Lie on a flat bench with a dumbbell in each hand above your chest.', 'Lower them slowly to the sides of your chest, elbows at about 45 degrees.', 'Press back up until your arms are almost straight.'],
    mistakes: ['Elbows flared straight out at 90 degrees.', 'Bouncing the weights at the bottom.'] },
  push_up: { name: 'Incline push-up', muscles: 'Chest, shoulders, triceps', kind: 'reps', needs: [], start: 8, step: 2, demo: 'pushup', alts: ['db_bench_press'],
    how: ['Put your hands on a bench or bar, a little wider than your shoulders.', 'Walk your feet back so your body is one straight line.', 'Lower your chest to the bench, elbows at about 45 degrees.', 'Push back up. Use a lower surface as it gets easier.'],
    mistakes: ['Hips sagging.', 'Only going halfway down.'] },
  db_row: { name: 'One-arm dumbbell row', muscles: 'Back and biceps', kind: 'weight', needs: ['dumbbells'], start: 8, step: 2, load: 'one dumbbell', perSide: true, demo: 'dbrow', alts: [],
    how: ['Put one hand and the same-side knee on a bench, back flat.', 'Hold a dumbbell in the other hand, arm hanging straight down.', 'Pull it up to your hip, elbow close to your body.', 'Lower slowly. Do all reps, then switch sides.'],
    mistakes: ['Twisting your chest open to lift the weight.', 'Shrugging the shoulder.'] },
  glute_bridge: { name: 'Glute bridge', muscles: 'Glutes and hamstrings', kind: 'reps', needs: [], start: 12, step: 2, demo: 'bridge', alts: [],
    how: ['Lie on your back with knees bent and feet flat, hip-width apart.', 'Push through your heels and lift your hips until your body is straight from shoulders to knees.', 'Squeeze your glutes for a second at the top, then lower slowly.'],
    mistakes: ['Arching the lower back instead of squeezing the glutes.', 'Feet too far from your hips.'] },
  knee_plank: { name: 'Knee plank', muscles: 'Core', kind: 'hold', needs: [], start: 20, step: 5, demo: 'kneeplank', alts: [],
    how: ['Rest on your forearms with elbows under your shoulders.', 'Keep your knees on the floor and make a straight line from knees to head.', 'Brace your stomach and breathe normally.'],
    mistakes: ['Hips sagging.', 'Hips pushed back over the knees.'] },
  machine_shoulder_press: { name: 'Machine shoulder press', muscles: 'Shoulders and triceps', kind: 'weight', needs: ['shoulder_machine'], start: 10, step: 5, load: 'on the stack', demo: 'press', alts: [],
    how: ['Set the seat so the handles start at about shoulder height.', 'Sit with your back against the pad.', 'Press up until your arms are almost straight, then lower slowly.'],
    mistakes: ['Arching your back away from the pad.', 'Locking the elbows hard.'] },
  split_squat: { name: 'Split squat', muscles: 'Legs and glutes', kind: 'reps', needs: [], start: 8, step: 2, perSide: true, demo: 'lunge', alts: [],
    how: ['Stand in a long stride, one foot forward and one back, and stay there.', 'Lower straight down until your back knee is just above the floor.', 'Push back up. Do all reps, then switch legs.'],
    mistakes: ['Stance too short.', 'Pushing off the back leg instead of the front.'] },
  bird_dog: { name: 'Bird dog', muscles: 'Core and lower back', kind: 'reps', needs: [], start: 6, step: 2, perSide: true, demo: 'birddog', alts: [],
    how: ['Start on hands and knees, hands under shoulders and knees under hips.', 'Reach your right arm forward and left leg back until both are level with your body.', 'Pause, return, and switch sides.'],
    mistakes: ['Hips rocking side to side.', 'Lifting the leg so high the back arches.'] },
};

export const GUIDANCE = [
  ['Gym etiquette', ['Wipe down machines and benches after you use them.', 'Put dumbbells and plates back where you found them.', 'Do not rest on a machine while scrolling. Rest, do your set, move on.', 'If someone is on the machine you need, ask "how many sets do you have left?" or swap to the alternative.', 'Nobody is watching you. Everyone started as a beginner.']],
  ['Setting up machines', ['Every machine has a diagram on it. Read it once before you sit.', 'Move the pin to the lightest weight, do a few reps, then go up.', 'Adjust the seat first: joints usually line up with the yellow or red pivot markers.', 'If something feels wrong in a joint, stop, lower the weight and re-check the seat height.', 'Ask a staff member to show you a machine once. That is what they are there for.']],
  ['What soreness is normal', ['Dull, achy muscles for 1 to 3 days after a session are normal, especially in week one. It fades as your body adapts.', 'Walking, stretching lightly and sleeping well help more than resting completely.', 'Sharp pain, pain in a joint, or pain that gets worse during a set is not normal. Stop that exercise.', 'If pain lasts more than a week, or you feel dizzy or unwell while training, see a doctor before continuing.']],
];
export const BASICS = [
  ['Sleep', '7 to 9 hours. Muscle is built while you rest, not while you lift.'],
  ['Water', 'Drink through the day and bring a bottle to the gym. Aim for pale yellow urine.'],
  ['Protein', 'Have some with every meal: eggs, beans, groundnuts, milk, fish, chicken or meat.'],
];
