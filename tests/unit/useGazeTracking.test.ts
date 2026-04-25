import {
  createGazeTrackingAccumulator,
  resolveGazeConfig,
  stepGazeTrackingAccumulator,
} from '../../src/hooks/useGazeTracking';

describe('useGazeTracking helpers', () => {
  it('emits a prolonged-away event once the continuous away threshold is crossed', () => {
    const config = resolveGazeConfig({
      gaze_config: {
        peripheral_max_cumulative_min: 30,
        away_max_continuous_s: 3,
      },
    });

    let accumulator = createGazeTrackingAccumulator();

    const initial = stepGazeTrackingAccumulator(accumulator, {
      zone: 'away',
      gazeAngle: 62,
      timestamp: 0,
    }, config);
    accumulator = initial.accumulator;

    const crossed = stepGazeTrackingAccumulator(accumulator, {
      zone: 'away',
      gazeAngle: 62,
      timestamp: 4200,
    }, config);

    expect(crossed.event?.type).toBe('gaze_prolonged_away');
    expect(crossed.event?.duration_ms).toBe(4200);
    expect(crossed.event?.metadata.angle).toBe(62);
  });

  it('emits a peripheral event with the trailing one-minute cumulative time', () => {
    const config = resolveGazeConfig({
      gaze_config: {
        peripheral_max_cumulative_min: 30,
        away_max_continuous_s: 3,
      },
    });

    let accumulator = createGazeTrackingAccumulator();

    accumulator = stepGazeTrackingAccumulator(accumulator, {
      zone: 'peripheral',
      gazeAngle: 22,
      timestamp: 0,
    }, config).accumulator;

    accumulator = stepGazeTrackingAccumulator(accumulator, {
      zone: 'on_screen',
      gazeAngle: 8,
      timestamp: 3000,
    }, config).accumulator;

    accumulator = stepGazeTrackingAccumulator(accumulator, {
      zone: 'peripheral',
      gazeAngle: 28,
      timestamp: 10000,
    }, config).accumulator;

    const exited = stepGazeTrackingAccumulator(accumulator, {
      zone: 'on_screen',
      gazeAngle: 5,
      timestamp: 35000,
    }, config);

    expect(exited.event?.type).toBe('gaze_peripheral');
    expect(exited.event?.duration_ms).toBe(25000);
    expect(exited.event?.metadata.cumulative_min_ms).toBe(28000);
    expect(exited.peripheralCumulativeLastMinuteMs).toBe(28000);
  });
});
