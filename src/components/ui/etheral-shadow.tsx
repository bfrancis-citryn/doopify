'use client';

import React, {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  animate,
  useMotionValue,
  type AnimationPlaybackControls,
} from 'framer-motion';

import styles from './etheral-shadow.module.css';

interface ResponsiveImage {
  src: string;
  alt?: string;
  srcSet?: string;
}

interface AnimationConfig {
  preview?: boolean;
  scale: number;
  speed: number;
}

interface NoiseConfig {
  opacity: number;
  scale: number;
}

interface ShadowOverlayProps {
  type?: 'preset' | 'custom';
  presetIndex?: number;
  customImage?: ResponsiveImage;
  sizing?: 'fill' | 'stretch';
  color?: string;
  animation?: AnimationConfig;
  noise?: NoiseConfig;
  style?: CSSProperties;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
  title?: string;
}

function mapRange(
  value: number,
  fromLow: number,
  fromHigh: number,
  toLow: number,
  toHigh: number
): number {
  if (fromLow === fromHigh) {
    return toLow;
  }

  const percentage = (value - fromLow) / (fromHigh - fromLow);
  return toLow + percentage * (toHigh - toLow);
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

const useInstanceId = (): string => {
  const id = useId();
  return `shadowoverlay-${id.replace(/:/g, '')}`;
};

export function Component({
  type = 'custom',
  customImage,
  sizing = 'fill',
  color = 'rgba(205, 180, 126, 0.88)',
  animation,
  noise,
  style,
  className,
  contentClassName,
  children,
  title = 'Ethereal Shadows',
}: ShadowOverlayProps) {
  const id = useInstanceId();
  const feColorMatrixRef = useRef<SVGFEColorMatrixElement>(null);
  const hueRotateMotionValue = useMotionValue(180);
  const hueRotateAnimation = useRef<AnimationPlaybackControls | null>(null);

  const animationEnabled = Boolean(animation && animation.scale > 0);
  const displacementScale = animation
    ? mapRange(animation.scale, 1, 100, 20, 100)
    : 0;
  const animationDuration = animation
    ? mapRange(animation.speed, 1, 100, 1000, 50)
    : 1;

  useEffect(() => {
    if (!feColorMatrixRef.current || !animationEnabled) {
      return;
    }

    hueRotateAnimation.current?.stop();
    hueRotateMotionValue.set(0);

    hueRotateAnimation.current = animate(hueRotateMotionValue, 360, {
      duration: animationDuration / 25,
      repeat: Infinity,
      repeatType: 'loop',
      ease: 'linear',
      onUpdate: (value: number) => {
        feColorMatrixRef.current?.setAttribute('values', String(value));
      },
    });

    return () => {
      hueRotateAnimation.current?.stop();
    };
  }, [animationDuration, animationEnabled, hueRotateMotionValue]);

  const shaderStyle: CSSProperties = {
    inset: animationEnabled ? `${-displacementScale}px` : 0,
    filter: animationEnabled ? `url(#${id}) blur(4px)` : 'none',
  };

  const overlayStyle: CSSProperties = {
    backgroundColor: color,
    maskImage:
      "url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png')",
    WebkitMaskImage:
      "url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png')",
    maskSize: sizing === 'stretch' ? '100% 100%' : 'cover',
    WebkitMaskSize: sizing === 'stretch' ? '100% 100%' : 'cover',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };

  const backgroundStyle: CSSProperties | undefined =
    type === 'custom' && customImage?.src
      ? {
          backgroundImage: `url("${customImage.src}")`,
        }
      : undefined;

  const noiseStyle: CSSProperties | undefined =
    noise && noise.opacity > 0
      ? {
          backgroundImage:
            'url("https://framerusercontent.com/images/g0QcWrxr87K0ufOxIUFBakwYA8.png")',
          backgroundSize: `${noise.scale * 200}px`,
          backgroundRepeat: 'repeat',
          opacity: noise.opacity / 2,
        }
      : undefined;

  return (
    <div className={joinClassNames(styles.root, className)} style={style}>
      {backgroundStyle ? (
        <div className={styles.backgroundImage} style={backgroundStyle} />
      ) : null}
      <div className={styles.backgroundTint} />
      <div className={styles.ambientGlow} />

      <div className={styles.shaderLayer} style={shaderStyle}>
        {animationEnabled ? (
          <svg aria-hidden="true" className={styles.filterSvg}>
            <defs>
              <filter id={id}>
                <feTurbulence
                  result="undulation"
                  numOctaves="2"
                  baseFrequency={`${mapRange(
                    animation!.scale,
                    0,
                    100,
                    0.001,
                    0.0005
                  )},${mapRange(animation!.scale, 0, 100, 0.004, 0.002)}`}
                  seed="0"
                  type="turbulence"
                />
                <feColorMatrix
                  ref={feColorMatrixRef}
                  in="undulation"
                  result="distortionHue"
                  type="hueRotate"
                  values="180"
                />
                <feColorMatrix
                  in="distortionHue"
                  result="circulation"
                  type="matrix"
                  values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="circulation"
                  scale={displacementScale}
                  result="dist"
                />
                <feDisplacementMap
                  in="dist"
                  in2="undulation"
                  scale={displacementScale}
                  result="output"
                />
              </filter>
            </defs>
          </svg>
        ) : null}

        <div className={styles.overlay} style={overlayStyle} />
      </div>

      <div className={joinClassNames(styles.content, contentClassName)}>
        {children ? (
          children
        ) : (
          <div className={styles.defaultContent}>
            <h1 className={styles.defaultTitle}>{title}</h1>
          </div>
        )}
      </div>

      {noiseStyle ? <div className={styles.noiseLayer} style={noiseStyle} /> : null}
    </div>
  );
}

export { Component as EtheralShadow };
