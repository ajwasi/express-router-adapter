import assert from 'assert';
import { joinPaths } from '../src/joinPaths';

// Expected values are the outputs the previously used `proper-url-join` produced for the same inputs.
describe('joinPaths', () => {
  const cases: Array<[string[], string]> = [
    [['/', '/'], '/'],
    [['/', '/pets/'], '/pets'],
    [['/', '/pets/:petId'], '/pets/:petId'],
    [['/api', '/pets/:petId'], '/api/pets/:petId'],
    [['/api/', '/pets/'], '/api/pets'],
    [['api', 'pets'], '/api/pets'],
    [['/api/v1', '/'], '/api/v1'],
    [['', '/pets'], '/pets'],
    [['/', 'pets/:id'], '/pets/:id'],
    [['/api//', '//pets'], '/api/pets']
  ];

  cases.forEach(([input, expected]) => {
    it(`joins ${JSON.stringify(input)} to ${JSON.stringify(expected)}`, () => {
      assert.strictEqual(joinPaths(...input), expected);
    });
  });
});
