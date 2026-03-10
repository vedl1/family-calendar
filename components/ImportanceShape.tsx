import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import type { Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';

export interface ImportanceShapeProps {
  importance: Importance;
  size?: number;
}

const VIEWBOX = '0 0 16 16';
const CENTER = 8;

/**
 * VCH-17: Renders an SVG shape for event importance (circle, triangle, diamond, star).
 * Fill colour from IMPORTANCE[importance].colour; viewBox 0 0 16 16.
 */
export function ImportanceShape({ importance, size = 16 }: ImportanceShapeProps) {
  const config = IMPORTANCE[importance];
  const colour = config?.colour ?? '#9CA3AF';
  const shape = config?.shape ?? 'circle';

  const content = (() => {
    switch (shape) {
      case 'circle':
        return <Circle cx={CENTER} cy={CENTER} r={7} fill={colour} />;
      case 'triangle':
        return <Polygon points={`${CENTER},2 14,14 2,14`} fill={colour} />;
      case 'diamond':
        return (
          <Polygon
            points={`${CENTER},0 16,${CENTER} ${CENTER},16 0,${CENTER}`}
            fill={colour}
          />
        );
      case 'star': {
        const points = '8,0 8,4 16,8 12,8 8,16 8,12 0,8 4,8';
        return <Polygon points={points} fill={colour} />;
      }
      default:
        return <Circle cx={CENTER} cy={CENTER} r={7} fill={colour} />;
    }
  })();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={VIEWBOX}>
        {content}
      </Svg>
    </View>
  );
}
