/** @jsx jsx */
import { useKeystone } from '@keystone-next/admin-ui/context';
import { RelationshipSelect } from '@keystone-next/fields/types/relationship/views/RelationshipSelect';
import { Stack, jsx } from '@keystone-ui/core';
import { FieldContainer, FieldLabel } from '@keystone-ui/fields';
import { Fragment, useState } from 'react';
import { ComponentPropField, RelationshipData, ComponentBlock } from '../../component-blocks';
import { useDocumentFieldRelationships, Relationships } from '../relationship';
import { RelationshipValues, onConditionalChange, assertNever } from './utils';
import { Button as KeystoneUIButton } from '@keystone-ui/button';
import { insertInitialValues } from './initial-values';

function FormValueContent({
  props,
  path,
  value,
  onChange,
  relationshipValues,
  onRelationshipValuesChange,
  stringifiedPropPathToAutoFocus,
  forceValidation,
}: {
  path: (string | number)[];
  props: Record<string, ComponentPropField>;
  value: any;
  relationshipValues: RelationshipValues;
  onRelationshipValuesChange(value: RelationshipValues): void;
  onChange(value: any): void;
  stringifiedPropPathToAutoFocus: string;
  forceValidation: boolean;
}) {
  const relationships = useDocumentFieldRelationships();
  const keystone = useKeystone();
  return (
    <Stack gap="xlarge">
      {Object.keys(props).map(key => {
        const prop = props[key];
        if (prop.kind === 'child') return null;
        if (prop.kind === 'object') {
          return (
            <FormValueContent
              forceValidation={forceValidation}
              stringifiedPropPathToAutoFocus={stringifiedPropPathToAutoFocus}
              onRelationshipValuesChange={onRelationshipValuesChange}
              relationshipValues={relationshipValues}
              key={key}
              path={path.concat(key)}
              props={prop.value}
              value={value[key]}
              onChange={val => {
                onChange({ ...value, [key]: val });
              }}
            />
          );
        }
        if (prop.kind === 'conditional') {
          const newPath = path.concat(key);
          return (
            <FormValueContent
              forceValidation={forceValidation}
              stringifiedPropPathToAutoFocus={stringifiedPropPathToAutoFocus}
              onRelationshipValuesChange={onRelationshipValuesChange}
              relationshipValues={relationshipValues}
              key={key}
              path={newPath}
              props={{
                discriminant: prop.discriminant,
                value: prop.values[value[key].discriminant],
              }}
              value={value[key]}
              onChange={val => {
                onConditionalChange(
                  val,
                  value[key],
                  newPath,
                  relationshipValues,
                  relationships,
                  onRelationshipValuesChange,
                  newVal => {
                    onChange({ ...value, [key]: newVal });
                  },
                  prop
                );
              }}
            />
          );
        }
        if (prop.kind === 'relationship') {
          const relationship = relationships[prop.relationship] as Extract<
            Relationships[string],
            { kind: 'prop' }
          >;
          const stringifiedPath = JSON.stringify(path.concat(key));
          const relationshipValue = relationshipValues[stringifiedPath];
          return (
            <FieldContainer key={key}>
              <FieldLabel>{prop.label}</FieldLabel>
              <RelationshipSelect
                autoFocus={stringifiedPath === stringifiedPropPathToAutoFocus}
                controlShouldRenderValue
                isDisabled={false}
                list={keystone.adminMeta.lists[relationship.listKey]}
                extraSelection={relationship.selection || ''}
                state={
                  relationship.many
                    ? {
                        kind: 'many',
                        value: (relationshipValue.data as RelationshipData[]).map(x => ({
                          id: x.id,
                          label: x.label || x.id,
                          data: x.data,
                        })),
                        onChange(data) {
                          onRelationshipValuesChange({
                            ...relationshipValues,
                            [stringifiedPath]: { data, relationship: prop.relationship },
                          });
                        },
                      }
                    : {
                        kind: 'one',
                        value: relationshipValue.data
                          ? {
                              ...(relationshipValue.data as RelationshipData),
                              label:
                                (relationshipValue.data as RelationshipData).label ||
                                (relationshipValue.data as RelationshipData).id,
                            }
                          : null,
                        onChange(data) {
                          onRelationshipValuesChange({
                            ...relationshipValues,
                            [stringifiedPath]: { data, relationship: prop.relationship },
                          });
                        },
                      }
                }
              />
            </FieldContainer>
          );
        }
        if (prop.kind === 'array') {
          const innerPath = path.concat(key);
          return (
            <div css={{ border: '2px solid red' }}>
              {value[key].map((val: any, i: number) => (
                <FormValueContent
                  forceValidation={forceValidation}
                  path={innerPath}
                  props={{
                    [i]: prop.field,
                  }}
                  relationshipValues={relationshipValues}
                  stringifiedPropPathToAutoFocus={stringifiedPropPathToAutoFocus}
                  value={{
                    [i]: val,
                  }}
                  onChange={newVal => {
                    onChange({
                      ...value,
                      [key]: value[key].map((x: any, index: number) =>
                        index === i ? newVal[i] : x
                      ),
                    });
                  }}
                  onRelationshipValuesChange={onRelationshipValuesChange}
                />
              ))}
              <button
                onClick={() => {
                  // THIS WILL BREAK FOR RELATIONSHIPS
                  const blockProps = {};
                  insertInitialValues(blockProps, { value: prop.field }, [], [], {}, relationships);
                  onChange({ ...value, [key]: [...value[key], (blockProps as any).value] });
                }}
              >
                Add new thing
              </button>
            </div>
          );
        }
        const newPath = path.concat(key);
        return (
          <Fragment key={key}>
            <prop.Input
              autoFocus={JSON.stringify(newPath) === stringifiedPropPathToAutoFocus}
              value={value[key]}
              onChange={newVal => {
                onChange({ ...value, [key]: newVal });
              }}
              forceValidation={forceValidation && !prop.validate(value[key])}
            />
          </Fragment>
        );
      })}
    </Stack>
  );
}

// child as in the props are a tree and you want the children of a prop, not as in the kind === 'inline'
function getChildProps(prop: ComponentPropField, value: any): Record<string, ComponentPropField> {
  if (prop.kind === 'conditional') {
    return {
      discriminant: prop.discriminant,
      value: prop.values[value.discriminant],
    };
  } else if (prop.kind === 'form' || prop.kind === 'child' || prop.kind === 'relationship') {
    return {};
  } else if (prop.kind === 'object') {
    return prop.value;
  } else if (prop.kind === 'array') {
    return Object.fromEntries(value.map((x: any, i: any) => [i, prop.field]));
  } else {
    assertNever(prop);
    // TypeScript should understand that this will never happen but for some reason it doesn't
    return {};
  }
}

function findFirstFocusablePropPath(
  props: Record<string, ComponentPropField>,
  path: (string | number)[],
  value: Record<string, any>
): (string | number)[] | undefined {
  for (const key of Object.keys(props)) {
    const prop = props[key];
    const newPath = path.concat(key);
    if (prop.kind === 'form' || prop.kind === 'relationship') {
      return newPath;
    }
    let children = getChildProps(prop, value[key]);
    const childFocusable = findFirstFocusablePropPath(children, newPath, value[key]);
    if (childFocusable) {
      return childFocusable;
    }
  }
}

export function FormValue({
  value,
  onClose,
  onChange,
  componentBlock,
  onRelationshipValuesChange,
  relationshipValues,
  isValid,
}: {
  value: any;
  onChange(value: any): void;
  onClose(): void;
  componentBlock: ComponentBlock;
  relationshipValues: RelationshipValues;
  onRelationshipValuesChange(value: RelationshipValues): void;
  isValid: boolean;
}) {
  const [forceValidation, setForceValidation] = useState(false);
  const focusablePath = JSON.stringify(findFirstFocusablePropPath(componentBlock.props, [], value));
  return (
    <Stack gap="xlarge" contentEditable={false}>
      <FormValueContent
        forceValidation={forceValidation}
        onRelationshipValuesChange={onRelationshipValuesChange}
        relationshipValues={relationshipValues}
        onChange={onChange}
        path={[]}
        props={componentBlock.props}
        value={value}
        stringifiedPropPathToAutoFocus={focusablePath}
      />
      <KeystoneUIButton
        size="small"
        tone="active"
        weight="bold"
        onClick={() => {
          if (isValid) {
            onClose();
          } else {
            setForceValidation(true);
          }
        }}
      >
        Done
      </KeystoneUIButton>
    </Stack>
  );
}
